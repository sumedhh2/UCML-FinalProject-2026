import sqlite3
import json
import os

OLD_DB = "fashion_app.db"
NEW_DB = "fashion_app2.db"

def create_new_schema(conn):
    cursor = conn.cursor()
    
    # 1. Main images table (no vibe/pieces JSON)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS images (
            image_id INTEGER PRIMARY KEY,
            filepath TEXT UNIQUE,
            style_label TEXT,
            embedding JSON
        )
    ''')
    
    # 2. Extract Vibes into a separate table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS image_vibes (
            vibe_id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_id INTEGER,
            vibe TEXT,
            FOREIGN KEY(image_id) REFERENCES images(image_id)
        )
    ''')

    # 3. Extract individual Pieces into a detailed table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS image_pieces (
            piece_id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_id INTEGER,
            category TEXT,
            item_name TEXT,
            color TEXT,
            fit TEXT,
            material TEXT,
            pattern TEXT,
            condition TEXT,
            detail TEXT,
            visibility TEXT,
            extra_attributes JSON,
            FOREIGN KEY(image_id) REFERENCES images(image_id)
        )
    ''')

    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Interactions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS interactions (
            interaction_id INTEGER PRIMARY KEY,
            user_id INTEGER,
            image_id INTEGER,
            liked BOOLEAN,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(user_id),
            FOREIGN KEY(image_id) REFERENCES images(image_id)
        )
    ''')
    conn.commit()

def migrate_data():
    if not os.path.exists(OLD_DB):
        print(f"Error: Old database '{OLD_DB}' not found.")
        return

    # Connect to both databases
    old_conn = sqlite3.connect(OLD_DB)
    old_conn.row_factory = sqlite3.Row
    new_conn = sqlite3.connect(NEW_DB)
    
    print(f"Creating new schema in {NEW_DB}...")
    create_new_schema(new_conn)
    
    old_cursor = old_conn.cursor()
    new_cursor = new_conn.cursor()

    # --- 1. Migrate Users ---
    print("Migrating users...")
    old_cursor.execute("SELECT * FROM users")
    users = old_cursor.fetchall()
    for user in users:
        new_cursor.execute('''
            INSERT INTO users (user_id, created_at) VALUES (?, ?)
        ''', (user["user_id"], user["created_at"]))
    
    # --- 2. Migrate Images, Vibes, and Pieces ---
    print("Migrating images, vibes, and pieces...")
    old_cursor.execute("SELECT * FROM images")
    images = old_cursor.fetchall()
    
    for img in images:
        # Insert base image data (preserve original image_id so interactions link correctly)
        new_cursor.execute('''
            INSERT INTO images (image_id, filepath, style_label, embedding)
            VALUES (?, ?, ?, ?)
        ''', (img["image_id"], img["filepath"], img["style_label"], img["embedding"]))
        
        # Parse and insert vibes
        try:
            vibes = json.loads(img["vibe"]) if img["vibe"] else []
            for v in vibes:
                new_cursor.execute('''
                    INSERT INTO image_vibes (image_id, vibe) VALUES (?, ?)
                ''', (img["image_id"], str(v).lower()))
        except json.JSONDecodeError:
            pass
            
        # Parse and insert pieces
        try:
            known_keys = {"category", "item", "color", "fit", "material", "pattern", "condition", "detail", "visibility"}
            pieces = json.loads(img["pieces"]) if img["pieces"] else []
            for piece in pieces:
                extra = {k: v for k, v in piece.items() if k not in known_keys}
                new_cursor.execute('''
                    INSERT INTO image_pieces (image_id, category, item_name, color, fit, material, pattern, condition, detail, visibility, extra_attributes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    img["image_id"],
                    piece.get("category"),
                    piece.get("item"),
                    piece.get("color"),
                    piece.get("fit"),
                    piece.get("material", "none"),
                    piece.get("pattern", "none"),
                    piece.get("condition", "none"),
                    piece.get("detail", "none"),
                    piece.get("visibility", "full"),
                    json.dumps(extra)
                ))
        except json.JSONDecodeError:
            pass

    # --- 3. Migrate Interactions ---
    print("Migrating interactions...")
    old_cursor.execute("SELECT * FROM interactions")
    interactions = old_cursor.fetchall()
    for interaction in interactions:
        new_cursor.execute('''
            INSERT INTO interactions (interaction_id, user_id, image_id, liked, timestamp)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            interaction["interaction_id"], 
            interaction["user_id"], 
            interaction["image_id"], 
            interaction["liked"], 
            interaction["timestamp"]
        ))

    # Commit all changes and close
    new_conn.commit()
    old_conn.close()
    new_conn.close()
    
    print(f"Migration complete! Data successfully moved to {NEW_DB}.")

if __name__ == "__main__":
    migrate_data()
