import os
import json
import sqlite3
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel, BlipProcessor, BlipForConditionalGeneration
from tqdm import tqdm

# --- Configuration ---
DATASET_DIR = "../pinterest_images" # Assuming this script runs from the backend folder
DB_PATH = "fashion_app.db"

# --- Models Setup ---
device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
print(f"Using device: {device}")

print("Loading CLIP Model...")
clip_model_id = "openai/clip-vit-base-patch32"
clip_model = CLIPModel.from_pretrained(clip_model_id).to(device)
clip_processor = CLIPProcessor.from_pretrained(clip_model_id)

print("Loading BLIP Model for Garment Tagging...")
# We use BLIP for zero-shot image captioning to extract clothing details
blip_model_id = "Salesforce/blip-image-captioning-base"
blip_processor = BlipProcessor.from_pretrained(blip_model_id)
blip_model = BlipForConditionalGeneration.from_pretrained(blip_model_id).to(device)

def get_clip_embedding(image):
    inputs = clip_processor(images=image, return_tensors="pt").to(device)
    with torch.no_grad():
        image_features = clip_model.get_image_features(**inputs)
    # Normalize the embedding
    image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
    return image_features.cpu().numpy().flatten().tolist()

def get_garment_tags(image):
    # Ask BLIP to describe the clothing in the image
    text = "a man wearing"
    inputs = blip_processor(image, text, return_tensors="pt").to(device)
    with torch.no_grad():
        out = blip_model.generate(**inputs, max_new_tokens=50)
    caption = blip_processor.decode(out[0], skip_special_tokens=True)
    
    # Simple extraction (we can refine this later with NLP if needed)
    # For now, we store the descriptive caption which contains the garments/textures
    return caption

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
    
    # We can also create the user and interaction tables here
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

    styles = [d for d in os.listdir(DATASET_DIR) if os.path.isdir(os.path.join(DATASET_DIR, d))]
    
    for style in styles:
        print(f"\nProcessing style folder: {style}")
        style_dir = os.path.join(DATASET_DIR, style)
        image_files = [f for f in os.listdir(style_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
        
        for img_file in tqdm(image_files):
            filepath = os.path.join(style_dir, img_file)
            
            # Check if already processed
            cursor.execute("SELECT image_id FROM images WHERE filepath = ?", (filepath,))
            if cursor.fetchone():
                continue
                
            try:
                image = Image.open(filepath).convert('RGB')
                
                # Extract features
                embedding = get_clip_embedding(image)
                tags = get_garment_tags(image)
                
                # Save to DB
                cursor.execute('''
                    INSERT INTO images (filepath, style_label, embedding, garment_tags)
                    VALUES (?, ?, ?, ?)
                ''', (filepath, style, json.dumps(embedding), tags))
                
                conn.commit()
            except Exception as e:
                print(f"Error processing {filepath}: {e}")

    conn.close()
    print("\nOffline processing complete! All images stored in the database.")

if __name__ == "__main__":
    process_images()
