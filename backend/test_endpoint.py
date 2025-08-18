from fastapi.testclient import TestClient
from app.main import app
from fastapi.routing import APIRoute

if __name__ == "__main__":
    client = TestClient(app)

    # Test the admin delete endpoint (ad-hoc debug)
    response = client.delete("/tracks/admin/1")
    print(f"Status code: {response.status_code}")
    print(
        f"Response: {response.json() if response.status_code != 404 else 'Not Found'}"
    )

    # Print all available routes (avoid accessing .methods on non-APIRoute types like Mount)
    for route in app.routes:
        if isinstance(route, APIRoute):
            print(f"Route: {route.path}, Methods: {route.methods}")
        else:
            print(f"Route: {getattr(route, 'path', repr(route))}, Type: {type(route).__name__}")