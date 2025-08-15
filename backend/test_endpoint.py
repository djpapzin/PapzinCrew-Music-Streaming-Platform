from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Test the admin delete endpoint
response = client.delete("/tracks/admin/1")
print(f"Status code: {response.status_code}")
print(f"Response: {response.json() if response.status_code != 404 else 'Not Found'}")

# Print all available routes
for route in app.routes:
    print(f"Route: {route.path}, Methods: {route.methods}")