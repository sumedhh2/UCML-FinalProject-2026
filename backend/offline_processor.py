import os
import re
import json
import sqlite3
import torch
import argparse
import random
from PIL import Image
from transformers import CLIPProcessor, CLIPModel, Qwen2_5_VLForConditionalGeneration, AutoProcessor
from qwen_vl_utils import process_vision_info
from tqdm import tqdm

# --- Configuration ---
DATASET_DIR = "../pinterest_images"
DB_PATH = "fashion_app.db"

# --- CLI Arguments ---
parser = argparse.ArgumentParser(description="Process fashion images with CLIP and Qwen2.5-VL")
parser.add_argument("--sample", action="store_true", help="Process only 5 images and show results")
parser.add_argument("--batch-size", type=int, default=4, help="Batch size for processing")
args = parser.parse_args()

# --- Models Setup ---
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

print("Loading CLIP Model...")
clip_model_id = "openai/clip-vit-base-patch32"
clip_model = CLIPModel.from_pretrained(clip_model_id).to(device)
clip_processor = CLIPProcessor.from_pretrained(clip_model_id)

print("Loading Qwen2.5-VL-7B-Instruct...")
qwen_model_id = "Qwen/Qwen2.5-VL-7B-Instruct"
# Load model in bfloat16 for A100 efficiency
qwen_model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
    qwen_model_id, torch_dtype=torch.bfloat16, device_map="auto"
)
qwen_processor = AutoProcessor.from_pretrained(qwen_model_id)
qwen_processor.tokenizer.padding_side = 'left'

prompt = ""
with open("prompt.txt") as f:
    prompt = f.read()

def get_clip_embedding_batch(images):
    inputs = clip_processor(images=images, return_tensors="pt", padding=True).to(device)
    with torch.no_grad():
        outputs = clip_model.get_image_features(**inputs)
    
    # Handle cases where get_image_features returns a ModelOutput object instead of a raw tensor
    if hasattr(outputs, "image_embeds"):
        image_features = outputs.image_embeds
    elif isinstance(outputs, torch.Tensor):
        image_features = outputs
    else:
        image_features = outputs[0]
        
    image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
    return image_features.cpu().numpy().tolist()

def get_fashion_attributes_batch(image_paths):
    # Prepare messages for Qwen2.5-VL batch
    messages_batch = []
    for image_path in image_paths:
        messages_batch.append([
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image_path},
                    {"type": "text", "text": prompt},
                ],
            }
        ])
    
    # Preparation for inference
    texts = [qwen_processor.apply_chat_template(msg, tokenize=False, add_generation_prompt=True) for msg in messages_batch]
    image_inputs, video_inputs = process_vision_info(messages_batch)
    inputs = qwen_processor(
        text=texts,
        images=image_inputs,
        videos=video_inputs,
        padding=True,
        return_tensors="pt",
    ).to(device)

    # Inference
    with torch.no_grad():
        generated_ids = qwen_model.generate(**inputs, max_new_tokens=512)
    
    generated_ids_trimmed = [
        out_ids[len(in_ids) :] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
    ]
    output_texts = qwen_processor.batch_decode(
        generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
    )
    
    results = []
    for output_text in output_texts:
        # Robust JSON extraction
        output_text = output_text.strip()
        match = re.search(r'```(?:json)?(.*?)```', output_text, re.DOTALL)
        if match:
            json_str = match.group(1).strip()
        else:
            start = output_text.find('{')
            end = output_text.rfind('}')
            if start != -1 and end != -1 and end > start:
                json_str = output_text[start:end+1]
            else:
                json_str = output_text
                
        try:
            results.append(json.loads(json_str))
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON: {e}")
            print(f"Raw output was: {output_text}")
            results.append({"vibe": [], "pieces": []})
            
    return results

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS images (
            image_id INTEGER PRIMARY KEY AUTOINCREMENT,
            filepath TEXT UNIQUE,
            style_label TEXT,
            embedding JSON,
            vibe JSON,
            pieces JSON
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS interactions (
            interaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            image_id INTEGER,
            liked BOOLEAN,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(user_id),
            FOREIGN KEY(image_id) REFERENCES images(image_id)
        )
    ''')
    conn.commit()
    return conn

def process_images():
    conn = init_db()
    cursor = conn.cursor()
    
    if not os.path.exists(DATASET_DIR):
        print(f"Error: Dataset directory not found at {DATASET_DIR}")
        return

    # Gather all images
    all_image_data = []
    styles = [d for d in os.listdir(DATASET_DIR) if os.path.isdir(os.path.join(DATASET_DIR, d))]
    for style in styles:
        style_dir = os.path.join(DATASET_DIR, style)
        image_files = [f for f in os.listdir(style_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
        for img_file in image_files:
            all_image_data.append((os.path.join(style_dir, img_file), style))

    # Handle sampling
    if args.sample:
        print(f"\n--- SAMPLE MODE: Processing 5 random images ---\n")
        all_image_data = random.sample(all_image_data, min(5, len(all_image_data)))
        
    pending_images = []
    if not args.sample:
        for filepath, style in all_image_data:
            cursor.execute("SELECT image_id FROM images WHERE filepath = ?", (filepath,))
            if not cursor.fetchone():
                pending_images.append((filepath, style))
    else:
        pending_images = all_image_data
    
    batch_size = args.batch_size
    for i in tqdm(range(0, len(pending_images), batch_size), desc="Processing Batches"):
        batch = pending_images[i:i+batch_size]
        filepaths = [item[0] for item in batch]
        styles = [item[1] for item in batch]
                
        try:
            # Extract features
            images = [Image.open(fp).convert('RGB') for fp in filepaths]
            embeddings = get_clip_embedding_batch(images)
            tags_list = get_fashion_attributes_batch(filepaths)
            
            for filepath, style, embedding, tags in zip(filepaths, styles, embeddings, tags_list):
                if args.sample:
                    print(f"\nImage: {filepath}")
                    print(f"Style Folder: {style}")
                    print(f"Detected Attributes: {json.dumps(tags, indent=2)}")
                    print("-" * 30)
                else:
                    # Save to DB
                    vibe = tags.get("vibe", [])
                    pieces = tags.get("pieces", [])
                    cursor.execute('''
                        INSERT INTO images (filepath, style_label, embedding, vibe, pieces)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (filepath, style, json.dumps(embedding), json.dumps(vibe), json.dumps(pieces)))
            if not args.sample:
                conn.commit()
                
        except Exception as e:
            print(f"Error processing batch starting with {filepaths[0]}: {e}")

    conn.close()
    if not args.sample:
        print("\nOffline processing complete! All images stored in the database.")

if __name__ == "__main__":
    process_images()
