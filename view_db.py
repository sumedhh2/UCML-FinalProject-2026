import sqlite3
import json
import argparse
import sys

def main():
    parser = argparse.ArgumentParser(description="View tables in fashion_app2.db easily")
    parser.add_argument("--table", type=str, default="images", choices=["images", "users", "interactions", "image_vibes", "image_pieces"], help="Table to view")
    parser.add_argument("--limit", type=int, default=5, help="Number of rows to show")
    parser.add_argument("--offset", type=int, default=0, help="Offset for rows")
    args = parser.parse_args()

    db_path = "backend/fashion_app2.db"
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute(f"SELECT * FROM {args.table} LIMIT ? OFFSET ?", (args.limit, args.offset))
        rows = cursor.fetchall()

        if not rows:
            print(f"No rows found in table '{args.table}'.")
            return

        print(f"--- Showing {len(rows)} rows from '{args.table}' (Limit: {args.limit}, Offset: {args.offset}) ---")
        for row in rows:
            row_dict = dict(row)
            
            # Format fields for better readability
            if args.table == 'images':
                # Embeddings are large lists of floats, omit them for readability
                if 'embedding' in row_dict and row_dict['embedding']:
                    row_dict['embedding'] = "<embedding vector omitted for brevity>"
                
                # Fetch associated vibes
                cursor.execute("SELECT vibe FROM image_vibes WHERE image_id = ?", (row_dict['image_id'],))
                vibes = [v[0] for v in cursor.fetchall()]
                if vibes:
                    row_dict['vibes'] = vibes
                    
                # Fetch associated pieces
                cursor.execute("SELECT * FROM image_pieces WHERE image_id = ?", (row_dict['image_id'],))
                pieces = []
                for p_row in cursor.fetchall():
                    p_dict = dict(p_row)
                    if 'extra_attributes' in p_dict and p_dict['extra_attributes']:
                        try:
                            p_dict['extra_attributes'] = json.loads(p_dict['extra_attributes'])
                        except json.JSONDecodeError:
                            pass
                    pieces.append(p_dict)
                if pieces:
                    row_dict['pieces'] = pieces
            
            print(json.dumps(row_dict, indent=2))
            print("-" * 50)
            
    except sqlite3.OperationalError as e:
        print(f"Database error: {e}")
        sys.exit(1)
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    main()
