import sys
import os
from fastapi.testclient import TestClient
from app.main import app

# Create test client
client = TestClient(app)

# Print all routes
print("\nAll registered routes:")
for route in app.routes:
    if hasattr(route, 'path') and hasattr(route, 'methods'):
        print(f"Path: {route.path}, Methods: {route.methods}")

# Test the admin delete endpoint
response = client.delete("/tracks/admin/1")
print(f"\nResponse status: {response.status_code}")
print(f"Response body: {response.json() if response.status_code != 404 else 'Not Found'}")