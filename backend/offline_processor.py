import os
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

def get_clip_embedding(image):
    inputs = clip_processor(images=image, return_tensors="pt").to(device)
    with torch.no_grad():
        image_features = clip_model.get_image_features(**inputs)
    image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
    return image_features.cpu().numpy().flatten().tolist()

def get_fashion_attributes(image_path):
    # Prepare message for Qwen2.5-VL
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image_path},
                {
                    "type": "text", 
                    "text": (
                        "Analyze this man's outfit in detail. "
                        "List the specific garments (top, bottom, shoes, outerwear, accessories), "
                        "the fit (e.g., oversized, slim, regular), and the primary materials/textures. "
                        "Format the output as a clean comma-separated list of keywords. "
                        "Example: turtleneck, wool coat, slim chinos, leather boots, minimal, tailored."
                    )
                },
            ],
        }
    ]
    
    # Preparation for inference
    text = qwen_processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    image_inputs, video_inputs = process_vision_info(messages)
    inputs = qwen_processor(
        text=[text],
        images=image_inputs,
        videos=video_inputs,
        padding=True,
        return_tensors="pt",
    ).to(device)

    # Inference
    with torch.no_grad():
        generated_ids = qwen_model.generate(**inputs, max_new_tokens=128)
    
    generated_ids_trimmed = [
        out_ids[len(in_ids) :] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
    ]
    output_text = qwen_processor.batch_decode(
        generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
    )[0]
    
    return output_text.strip()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS images (
            image_id INTEGER PRIMARY KEY AUTOINCREMENT,
            filepath TEXT UNIQUE,
            style_label TEXT,
            embedding JSON,
            garment_tags TEXT
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
    
    for filepath, style in tqdm(all_image_data, desc="Processing Images"):
        # Skip if already processed (only in full mode)
        if not args.sample:
            cursor.execute("SELECT image_id FROM images WHERE filepath = ?", (filepath,))
            if cursor.fetchone():
                continue
                
        try:
            # Extract features
            image = Image.open(filepath).convert('RGB')
            embedding = get_clip_embedding(image)
            tags = get_fashion_attributes(filepath)
            
            if args.sample:
                print(f"\nImage: {filepath}")
                print(f"Style Folder: {style}")
                print(f"Detected Attributes: {tags}")
                print("-" * 30)
            else:
                # Save to DB
                cursor.execute('''
                    INSERT INTO images (filepath, style_label, embedding, garment_tags)
                    VALUES (?, ?, ?, ?)
                ''', (filepath, style, json.dumps(embedding), tags))
                conn.commit()
                
        except Exception as e:
            print(f"Error processing {filepath}: {e}")

    conn.close()
    if not args.sample:
        print("\nOffline processing complete! All images stored in the database.")

if __name__ == "__main__":
    process_images()
