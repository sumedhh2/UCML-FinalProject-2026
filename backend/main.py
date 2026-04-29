from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any
import sqlite3
import json
import os
import random
import numpy as np
from collections import Counter

app = FastAPI(title="Fashion Aesthetic Backend")

DB_PATH = "../fashion_app2.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# --- Pydantic Models ---
class Interaction(BaseModel):
    user_id: int
    image_id: int
    liked: bool

# --- Helper Functions ---
def cosine_similarity(v1, v2):
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

# --- Endpoints ---

@app.post("/users/create")
def create_user():
    """Initializes a new user session."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO users DEFAULT VALUES")
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"user_id": user_id}

@app.get("/recommendations/{user_id}")
def get_recommendations(user_id: int, batch_size: int = 10):
    """
    Returns a batch of images for the user to swipe on.
    Uses cold-start (random diverse) if no history, otherwise uses similarity-based active learning.
    """
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Get images the user has already interacted with
    cursor.execute("SELECT image_id, liked FROM interactions WHERE user_id = ?", (user_id,))
    interactions = cursor.fetchall()
    seen_image_ids = [row["image_id"] for row in interactions]
    liked_image_ids = [row["image_id"] for row in interactions if row["liked"]]
    disliked_image_ids = [row["image_id"] for row in interactions if not row["liked"]]
    
    # 2. Get all unseen images
    placeholders = ','.join(['?'] * len(seen_image_ids)) if seen_image_ids else '?'
    query = f"SELECT image_id, filepath, style_label, embedding FROM images"
    if seen_image_ids:
        query += f" WHERE image_id NOT IN ({placeholders})"
        cursor.execute(query, seen_image_ids)
    else:
        cursor.execute(query)
    
    unseen_images = cursor.fetchall()
    
    if not unseen_images:
        conn.close()
        return {"recommendations": [], "message": "No more images available."}
        
    recommended_images = []

    # 3. Cold Start or Active Learning
    if not liked_image_ids:
        # COLD START: Provide a random, diverse mix
        styles_map = {}
        for img in unseen_images:
            styles_map.setdefault(img["style_label"], []).append(img)
            
        for style, imgs in styles_map.items():
            if imgs:
                recommended_images.append(random.choice(imgs))
                if len(recommended_images) >= batch_size:
                    break
                    
        while len(recommended_images) < batch_size and unseen_images:
            remaining = [img for img in unseen_images if img not in recommended_images]
            if not remaining:
                break
            recommended_images.append(random.choice(remaining))
            
    else:
        # ACTIVE LEARNING: Hybrid Scoring Model (Visual Late-Fusion + Granular Text)
        liked_placeholders = ','.join(['?'] * len(liked_image_ids))
        
        # --- Visual Scoring Setup (Embeddings) ---
        cursor.execute(f"SELECT embedding FROM images WHERE image_id IN ({liked_placeholders})", liked_image_ids)
        liked_embeddings = [np.array(json.loads(row["embedding"])).flatten() for row in cursor.fetchall()]
        
        try:
            from sklearn.cluster import KMeans
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                n_clusters = min(3, len(liked_embeddings))
                kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init='auto').fit(liked_embeddings)
                liked_centroids = kmeans.cluster_centers_
        except ImportError:
            liked_centroids = [np.mean(liked_embeddings, axis=0)]

        disliked_centroid = None
        if disliked_image_ids:
            dis_placeholders = ','.join(['?'] * len(disliked_image_ids))
            cursor.execute(f"SELECT embedding FROM images WHERE image_id IN ({dis_placeholders})", disliked_image_ids)
            dis_embs = [np.array(json.loads(r["embedding"])).flatten() for r in cursor.fetchall()]
            if dis_embs:
                disliked_centroid = np.mean(dis_embs, axis=0)

        # --- Text Scoring Setup (Granular Attributes) ---
        cursor.execute(f"SELECT vibe FROM image_vibes WHERE image_id IN ({liked_placeholders})", liked_image_ids)
        vibe_counts = Counter([r["vibe"] for r in cursor.fetchall()])
        total_vibes = sum(vibe_counts.values()) or 1
        
        cursor.execute(f"SELECT fit, material FROM image_pieces WHERE image_id IN ({liked_placeholders})", liked_image_ids)
        liked_pieces = cursor.fetchall()
        fit_counts = Counter([r["fit"] for r in liked_pieces if r["fit"] != 'none'])
        mat_counts = Counter([r["material"] for r in liked_pieces if r["material"] != 'none'])
        total_fits = sum(fit_counts.values()) or 1
        total_mats = sum(mat_counts.values()) or 1

        dis_fit_counts = Counter()
        dis_mat_counts = Counter()
        total_dis_fits, total_dis_mats = 1, 1
        if disliked_image_ids:
            cursor.execute(f"SELECT fit, material FROM image_pieces WHERE image_id IN ({dis_placeholders})", disliked_image_ids)
            dis_pieces = cursor.fetchall()
            dis_fit_counts = Counter([r["fit"] for r in dis_pieces if r["fit"] != 'none'])
            dis_mat_counts = Counter([r["material"] for r in dis_pieces if r["material"] != 'none'])
            total_dis_fits = sum(dis_fit_counts.values()) or 1
            total_dis_mats = sum(dis_mat_counts.values()) or 1

        # Score unseen images
        scored_images = []
        for img in unseen_images:
            img_id = img["image_id"]
            img_emb = np.array(json.loads(img["embedding"])).flatten()
            
            # Visual Score (Max sim to any liked centroid)
            visual_score = max(cosine_similarity(c, img_emb) for c in liked_centroids)
            
            # Visual Penalty
            penalty_score = cosine_similarity(disliked_centroid, img_emb) if disliked_centroid is not None else 0
                
            # Granular Attributes
            cursor.execute("SELECT vibe FROM image_vibes WHERE image_id = ?", (img_id,))
            img_vibes = [r["vibe"] for r in cursor.fetchall()]
            vibe_score = sum((vibe_counts.get(v, 0) / total_vibes) for v in img_vibes)
            
            cursor.execute("SELECT fit, material FROM image_pieces WHERE image_id = ?", (img_id,))
            img_pieces = cursor.fetchall()
            fit_score, mat_score = 0, 0
            dis_fit_penalty, dis_mat_penalty = 0, 0
            
            for p in img_pieces:
                if p["fit"] != 'none':
                    fit_score += (fit_counts.get(p["fit"], 0) / total_fits)
                    dis_fit_penalty += (dis_fit_counts.get(p["fit"], 0) / total_dis_fits)
                if p["material"] != 'none':
                    mat_score += (mat_counts.get(p["material"], 0) / total_mats)
                    dis_mat_penalty += (dis_mat_counts.get(p["material"], 0) / total_dis_mats)
            
            granular_score = vibe_score + fit_score + mat_score
            attribute_penalty = dis_fit_penalty + dis_mat_penalty
            
            # Hybrid Calculation
            # W1=1.0 (Visual), W2=0.5 (Granular), W3=0.5 (Visual Penalty), W4=0.3 (Attribute Penalty)
            total_score = (1.0 * visual_score) + (0.5 * granular_score) - (0.5 * penalty_score) - (0.3 * attribute_penalty)
                
            scored_images.append((total_score, img))
            
        # Sort by score descending
        scored_images.sort(key=lambda x: x[0], reverse=True)
        
        # Epsilon-greedy exploration
        num_exploit = int(batch_size * 0.8)
        num_explore = batch_size - num_exploit
        
        top_picks = [img for score, img in scored_images[:num_exploit]]
        remaining = [img for score, img in scored_images[num_exploit:]]
        random_picks = random.sample(remaining, min(num_explore, len(remaining)))
        
        recommended_images = top_picks + random_picks
        random.shuffle(recommended_images)

    conn.close()
    
    # Format the response
    results = []
    for img in recommended_images[:batch_size]:
        results.append({
            "image_id": img["image_id"],
            "style_label": img["style_label"],
            "image_url": f"/images/{img['image_id']}"
        })
        
    return {"recommendations": results}

@app.post("/interactions")
def log_interaction(interaction: Interaction):
    """Records a user's swipe (like/dislike)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO interactions (user_id, image_id, liked)
        VALUES (?, ?, ?)
    ''', (interaction.user_id, interaction.image_id, interaction.liked))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/profile/{user_id}")
def get_profile(user_id: int):
    """
    Analyzes the user's interaction history to generate their Aesthetic Profile,
    including overall vibes, dominant styles, and frequently liked pieces.
    """
    conn = get_db()
    cursor = conn.cursor()
    
    # Get liked interactions
    cursor.execute('''
        SELECT i.image_id, i.style_label 
        FROM interactions inter
        JOIN images i ON inter.image_id = i.image_id
        WHERE inter.user_id = ? AND inter.liked = 1
    ''', (user_id,))
    
    liked_images = cursor.fetchall()
    
    if not liked_images:
        conn.close()
        return {"message": "Not enough data to generate a profile yet. Keep swiping!"}
        
    liked_ids = [r["image_id"] for r in liked_images]
    placeholders = ','.join(['?'] * len(liked_ids))
    
    # Process Styles
    styles = [r["style_label"] for r in liked_images]
    top_styles = [style for style, _ in Counter(styles).most_common(3)]
    
    # Process Vibes
    cursor.execute(f"SELECT vibe FROM image_vibes WHERE image_id IN ({placeholders})", liked_ids)
    vibes = [r["vibe"] for r in cursor.fetchall()]
    top_vibes = [{"vibe": v, "count": c} for v, c in Counter(vibes).most_common(5)]
    
    # Process Pieces (Basic format for now, to be upgraded)
    cursor.execute(f"SELECT fit, material, item_name FROM image_pieces WHERE image_id IN ({placeholders})", liked_ids)
    pieces = cursor.fetchall()
    
    piece_summaries = []
    for p in pieces:
        parts = []
        if p["fit"] and p["fit"] != 'none': parts.append(p["fit"])
        if p["material"] and p["material"] != 'none': parts.append(p["material"])
        if p["item_name"]: parts.append(p["item_name"])
        if parts:
            piece_summaries.append(" ".join(parts))
            
    suggested_pieces = [{"piece": p, "count": c} for p, c in Counter(piece_summaries).most_common(10)]
    
    conn.close()
    
    return {
        "user_id": user_id,
        "total_liked": len(liked_images),
        "dominant_styles": top_styles,
        "top_vibes": top_vibes,
        "suggested_pieces_to_buy": suggested_pieces
    }
    
    return {
        "user_id": user_id,
        "total_liked": len(liked_images),
        "dominant_styles": top_styles,
        "top_vibes": top_vibes,
        "suggested_pieces_to_buy": suggested_pieces
    }

@app.get("/images/{image_id}")
def serve_image(image_id: int):
    """Serves the actual image file."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT filepath FROM images WHERE image_id = ?", (image_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Image not found")
        
    filepath = row["filepath"]
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File does not exist on disk")
        
    return FileResponse(filepath)

# To run: uvicorn main:app --reload
