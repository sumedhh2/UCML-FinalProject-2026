from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any
import sqlite3
import json
import os
import random
import numpy as np
from collections import Counter, defaultdict

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Fashion Aesthetic Backend")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allow all. You can restrict to ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

def parse_embedding(raw_emb):
    if isinstance(raw_emb, str):
        return np.array(json.loads(raw_emb), dtype=np.float32).flatten()
    return np.frombuffer(raw_emb, dtype=np.float32)

def _diverse_cold_start(candidates, k):
    """Greedy farthest-point sampling in embedding space for maximum visual diversity."""
    if len(candidates) <= k:
        return [img for img, _ in candidates]
    selected_imgs = [candidates[0][0]]
    selected_embs = [candidates[0][1]]
    remaining = list(candidates[1:])
    while len(selected_imgs) < k and remaining:
        best_idx, best_dist = 0, -1.0
        for i, (img, emb) in enumerate(remaining):
            min_dist = min(1.0 - float(cosine_similarity(emb, se)) for se in selected_embs)
            if min_dist > best_dist:
                best_dist = min_dist
                best_idx = i
        chosen_img, chosen_emb = remaining.pop(best_idx)
        selected_imgs.append(chosen_img)
        selected_embs.append(chosen_emb)
    return selected_imgs


def build_rich_description(p):
    """Combines all piece attributes into a specific, human-readable description string."""
    parts = []
    if p["color"] and p["color"] not in ("none", None): parts.append(p["color"])
    if p["fit"]   and p["fit"]   not in ("none", None): parts.append(p["fit"])
    if p["material"] and p["material"] not in ("none", None): parts.append(p["material"])
    if p["pattern"] and p["pattern"] not in ("none", None): parts.append(p["pattern"])
    if p["item_name"]: parts.append(p["item_name"])
    return " ".join(parts)


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
    
    # 2. Get all unseen and non-blacklisted images
    query = "SELECT image_id, filepath, style_label, embedding FROM images WHERE image_id NOT IN (SELECT image_id FROM blacklist)"
    
    if seen_image_ids:
        placeholders = ','.join(['?'] * len(seen_image_ids))
        query += f" AND image_id NOT IN ({placeholders})"
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
        # COLD START: Greedy farthest-point sampling for maximum visual diversity
        candidates = [(img, parse_embedding(img["embedding"])) for img in unseen_images]
        recommended_images = _diverse_cold_start(candidates, batch_size)
            
    else:
        # ACTIVE LEARNING: Hybrid Scoring Model (Visual Late-Fusion + Granular Text)
        liked_placeholders = ','.join(['?'] * len(liked_image_ids))
        
        # --- Visual Scoring Setup (Embeddings) ---
        cursor.execute(f"SELECT embedding FROM images WHERE image_id IN ({liked_placeholders})", liked_image_ids)
        liked_embeddings = [parse_embedding(row["embedding"]) for row in cursor.fetchall()]
        
        try:
            from sklearn.cluster import KMeans
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                # Scale clusters with session depth: 1 per 5 likes, capped at 8
                n_clusters = min(max(2, len(liked_embeddings) // 5), 8)
                n_clusters = min(n_clusters, len(liked_embeddings))
                kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init='auto').fit(liked_embeddings)
                liked_centroids = kmeans.cluster_centers_
        except ImportError:
            liked_centroids = [np.mean(liked_embeddings, axis=0)]

        disliked_centroid = None
        if disliked_image_ids:
            dis_placeholders = ','.join(['?'] * len(disliked_image_ids))
            cursor.execute(f"SELECT embedding FROM images WHERE image_id IN ({dis_placeholders})", disliked_image_ids)
            dis_embs = [parse_embedding(r["embedding"]) for r in cursor.fetchall()]
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

        # Dynamic penalty weights: scale up as user's dislike ratio increases
        n_liked_count = len(liked_image_ids)
        n_disliked_count = len(disliked_image_ids)
        dislike_ratio = n_disliked_count / (n_liked_count + n_disliked_count + 1e-9)
        penalty_weight = 0.5 + (0.5 * dislike_ratio)      # 0.5 → 1.0
        attr_penalty_weight = 0.3 + (0.3 * dislike_ratio)  # 0.3 → 0.6

        # Score unseen images
        scored_images = []
        for img in unseen_images:
            img_id = img["image_id"]
            img_emb = parse_embedding(img["embedding"])
            
            # Visual Score (Max sim to any liked centroid)
            visual_score = max(cosine_similarity(c, img_emb) for c in liked_centroids)
            
            # Visual Penalty
            penalty_score = cosine_similarity(disliked_centroid, img_emb) if disliked_centroid is not None else 0
                
            # Granular Attributes (normalized by attribute count to prevent runaway scores)
            cursor.execute("SELECT vibe FROM image_vibes WHERE image_id = ?", (img_id,))
            img_vibes = [r["vibe"] for r in cursor.fetchall()]
            raw_vibe = sum((vibe_counts.get(v, 0) / total_vibes) for v in img_vibes)
            vibe_score = raw_vibe / (len(img_vibes) + 1e-9)
            
            cursor.execute("SELECT fit, material FROM image_pieces WHERE image_id = ?", (img_id,))
            img_pieces = cursor.fetchall()
            fit_score, mat_score = 0.0, 0.0
            dis_fit_penalty, dis_mat_penalty = 0.0, 0.0
            
            for p in img_pieces:
                if p["fit"] != 'none':
                    fit_score += (fit_counts.get(p["fit"], 0) / total_fits)
                    dis_fit_penalty += (dis_fit_counts.get(p["fit"], 0) / total_dis_fits)
                if p["material"] != 'none':
                    mat_score += (mat_counts.get(p["material"], 0) / total_mats)
                    dis_mat_penalty += (dis_mat_counts.get(p["material"], 0) / total_dis_mats)

            n_pieces = len(img_pieces) + 1e-9
            fit_score /= n_pieces
            mat_score /= n_pieces
            dis_fit_penalty /= n_pieces
            dis_mat_penalty /= n_pieces

            granular_score = vibe_score + fit_score + mat_score
            attribute_penalty = dis_fit_penalty + dis_mat_penalty
            
            # Hybrid Calculation with dynamic penalty weights
            total_score = (1.0 * visual_score) + (0.5 * granular_score) \
                        - (penalty_weight * penalty_score) \
                        - (attr_penalty_weight * attribute_penalty)
                
            scored_images.append((total_score, img))
            
        # Sort by score descending
        scored_images.sort(key=lambda x: x[0], reverse=True)
        
        # Adaptive epsilon-greedy: start at 40% exploration, decay toward 10% over ~50 swipes
        total_interactions = len(seen_image_ids)
        explore_fraction = max(0.10, 0.40 * (0.95 ** total_interactions))
        num_exploit = int(batch_size * (1 - explore_fraction))
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
    
    # Get liked interactions with embeddings for centrality calculation
    cursor.execute('''
        SELECT i.image_id, i.style_label, i.embedding
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
    
    # --- Refined Recommendation Logic ---
    NEUTRAL_COLORS = {'black', 'white', 'gray', 'grey', 'navy', 'beige', 'cream', 'tan', 'khaki', 'ivory', 'charcoal', 'taupe', 'off-white'}
    BASIC_PATTERNS = {'none', 'solid'}
    STATEMENT_VIBES = {'bold', 'maximalist', 'avant-garde', 'edgy', 'graphic'}

    def is_basic(p):
        color_lower = (p["color"] or "").lower()
        pattern_lower = (p["pattern"] or "").lower()
        return color_lower in NEUTRAL_COLORS and pattern_lower in BASIC_PATTERNS

    def is_statement(p, img_vibes):
        color_lower = (p["color"] or "").lower()
        pattern_lower = (p["pattern"] or "").lower()
        # Statement if: non-neutral color OR non-basic pattern OR has a statement vibe
        has_statement_color = color_lower and color_lower not in NEUTRAL_COLORS and color_lower != 'none'
        has_statement_pattern = pattern_lower and pattern_lower not in BASIC_PATTERNS and pattern_lower != 'none'
        has_statement_vibe = any(v in STATEMENT_VIBES for v in img_vibes)
        return has_statement_color or has_statement_pattern or has_statement_vibe

    # Get all pieces and vibes for liked images
    cursor.execute(f"SELECT image_id, item_name, color, fit, material, pattern, category FROM image_pieces WHERE image_id IN ({placeholders})", liked_ids)
    all_liked_pieces = cursor.fetchall()
    
    cursor.execute(f"SELECT image_id, vibe FROM image_vibes WHERE image_id IN ({placeholders})", liked_ids)
    vibes_rows = cursor.fetchall()
    image_vibes_map = defaultdict(list)
    for r in vibes_rows:
        image_vibes_map[r["image_id"]].append(r["vibe"])

    # --- Sophisticated Centroid-Based Selection ---
    
    # Map image_id to parsed embedding for quick lookup
    image_embeddings = {r["image_id"]: parse_embedding(r["embedding"]) for r in liked_images}
    all_embs = list(image_embeddings.values())
    global_centroid = np.mean(all_embs, axis=0) if all_embs else None

    # Group liked images by style
    style_groups = defaultdict(list)
    style_embeddings = defaultdict(list)
    for r in liked_images:
        style_groups[r["style_label"]].append(r["image_id"])
        style_embeddings[r["style_label"]].append(image_embeddings[r["image_id"]])
    
    ranked_styles = sorted(style_groups.items(), key=lambda x: len(x[1]), reverse=True)
    dominant_style = ranked_styles[0][0] if ranked_styles else "Unknown"
    secondary_style = ranked_styles[1][0] if len(ranked_styles) > 1 else dominant_style

    # Calculate style-specific centroids
    secondary_embs = style_embeddings.get(secondary_style, [])
    secondary_centroid = np.mean(secondary_embs, axis=0) if secondary_embs else global_centroid

    def score_piece(p, target_centroid):
        if target_centroid is None: return 0
        img_emb = image_embeddings.get(p["image_id"])
        if img_emb is None: return 0
        return float(cosine_similarity(img_emb, target_centroid))

    # --- 5-Piece Capsule Logic ---
    wardrobe_recommendations = []
    seen_descriptions = set()

    def add_rec(p, slot, style):
        desc = build_rich_description(p)
        if desc and desc not in seen_descriptions:
            wardrobe_recommendations.append({
                "slot": slot,
                "style": style,
                "description": desc,
                "category": p["category"]
            })
            seen_descriptions.add(desc)
            return True
        return False

    # 1. Statement Pieces (Pick Top 2)
    statement_candidates = [p for p in all_liked_pieces if is_statement(p, image_vibes_map[p["image_id"]])]
    if statement_candidates:
        statement_candidates.sort(key=lambda p: score_piece(p, global_centroid), reverse=True)
        added = 0
        for p in statement_candidates:
            if add_rec(p, "statement", dominant_style):
                added += 1
            if added >= 2: break

    # 2. Basic Essentials (Pick Top 2 with Fallback)
    basic_candidates = [p for p in all_liked_pieces if is_basic(p)]
    # Fallback: If not enough "perfect" basics, look for neutral colors regardless of pattern
    if len(basic_candidates) < 2:
        neutrals = [p for p in all_liked_pieces if (p["color"] or "").lower() in NEUTRAL_COLORS]
        for p in neutrals:
            if p not in basic_candidates:
                basic_candidates.append(p)
    
    # Final Fallback: Just pick anything that hasn't been picked, prioritizing pieces closest to global centroid
    if len(basic_candidates) < 2:
        all_sorted = sorted(all_liked_pieces, key=lambda p: score_piece(p, global_centroid), reverse=True)
        for p in all_sorted:
            if p not in basic_candidates:
                basic_candidates.append(p)

    basic_candidates.sort(key=lambda p: score_piece(p, global_centroid), reverse=True)
    added = 0
    for p in basic_candidates:
        if add_rec(p, "basic", dominant_style):
            added += 1
        if added >= 2: break

    # 3. Wild Card (Pick Top 1 from secondary style)
    secondary_image_ids = set(style_groups.get(secondary_style, []))
    wild_candidates = [p for p in all_liked_pieces if p["image_id"] in secondary_image_ids]
    if wild_candidates:
        wild_candidates.sort(key=lambda p: score_piece(p, secondary_centroid), reverse=True)
        for p in wild_candidates:
            if add_rec(p, "wild_card", secondary_style):
                break # Just 1 wild card

    conn.close()

    return {
        "user_id": user_id,
        "total_liked": len(liked_images),
        "dominant_styles": top_styles,
        "top_vibes": top_vibes,
        "wardrobe_recommendations": wardrobe_recommendations
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
    
@app.post("/blacklist/{image_id}")
def blacklist_image(image_id: int):
    """Adds an image to the global blacklist to prevent it from being recommended."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT OR IGNORE INTO blacklist (image_id) VALUES (?)", (image_id,))
        conn.commit()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
    conn.close()
    return {"status": "success", "message": f"Image {image_id} has been blacklisted."}

# To run: uvicorn main:app --reload
