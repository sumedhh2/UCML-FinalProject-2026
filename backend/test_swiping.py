import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def main():
    print("Testing Fashion Backend...\n")
    
    # 1. Create a user
    try:
        resp = requests.post(f"{BASE_URL}/users/create")
        user_id = resp.json()["user_id"]
        print(f"Created new user with ID: {user_id}")
    except requests.exceptions.ConnectionError:
        print(f"Error: Could not connect to {BASE_URL}. Is your FastAPI server running? (Run: uvicorn main:app --reload)")
        return

    # 2. Start a swiping loop
    for round_num in range(1, 4):
        print(f"\n--- SWIPE ROUND {round_num} ---")
        
        # Get recommendations
        rec_resp = requests.get(f"{BASE_URL}/recommendations/{user_id}?batch_size=3")
        recommendations = rec_resp.json().get("recommendations", [])
        
        if not recommendations:
            print("No more recommendations available.")
            break
            
        print(f"Got {len(recommendations)} recommendations.")
        
        for img in recommendations:
            img_id = img["image_id"]
            style = img["style_label"]
            
            # Simulate a terminal 'swipe'
            print(f"\nImage ID {img_id} (Style: {style})")
            print(f"To view image, open: {BASE_URL}{img['image_url']}")
            
            while True:
                choice = input("Swipe Left (Dislike=0) or Swipe Right (Like=1)? [0/1]: ").strip()
                if choice in ["0", "1"]:
                    liked = bool(int(choice))
                    break
                print("Invalid input. Type 0 or 1.")
                
            # Log the interaction
            payload = {
                "user_id": user_id,
                "image_id": img_id,
                "liked": liked
            }
            requests.post(f"{BASE_URL}/interactions", json=payload)
            print(f"Logged interaction: {'Liked' if liked else 'Disliked'}")
            
    # 3. Check the generated profile
    print("\n--- GENERATED PROFILE ---")
    profile_resp = requests.get(f"{BASE_URL}/profile/{user_id}")
    print(json.dumps(profile_resp.json(), indent=2))

if __name__ == "__main__":
    main()
