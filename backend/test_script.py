import requests
BASE_URL = "http://127.0.0.1:8000"
rec_resp = requests.get(f"{BASE_URL}/recommendations/2?batch_size=3")
print(rec_resp.status_code)
print(rec_resp.text)
