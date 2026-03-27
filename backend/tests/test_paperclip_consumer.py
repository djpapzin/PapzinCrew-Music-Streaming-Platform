from __future__ import annotations

import json
import os
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
from app.services.paperclip_client import build_paperclip_summary_request, fetch_paperclip_summary


class FakePaperclipHandler(BaseHTTPRequestHandler):
    response_body = {
        "goal_id": "goal_paperclip_papzincrew_001",
        "initiative_id": "init_paperclip_phase1_mobile_publish_clarity",
        "initiative_title": "Mobile publish-state clarity",
        "business_status_summary": "Ready to improve the pre-publish state on mobile.",
        "current_tracker_phase": "review",
        "blocker_summary": "No current blocker.",
        "next_milestone": "Approve the dashboard consumer hook.",
        "risk_flag": "low",
        "budget_flag": "within_guardrail",
        "storage_flag": "healthy",
        "linked_tracker_cards": ["#203", "#204"],
        "last_updated": "2026-03-27T20:40:00Z",
        "audit_ref": "paperclip-phase1-bridge",
    }

    def log_message(self, format: str, *args: object) -> None:  # pragma: no cover - quiet test server
        return

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/api/task/203":
            body = json.dumps(self.response_body).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)


class PaperclipConsumerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def _start_fake_server(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), FakePaperclipHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        def cleanup() -> None:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.addCleanup(cleanup)
        return server

    def test_build_paperclip_summary_request_uses_expected_endpoint(self) -> None:
        request = build_paperclip_summary_request(203, base_url="http://paperclip.local")
        self.assertEqual(request.full_url, "http://paperclip.local/api/task/203")
        self.assertEqual(request.get_method(), "GET")
        self.assertEqual(request.get_header("Accept"), "application/json")

    def test_router_returns_summary_via_mocked_fetcher(self) -> None:
        with patch("app.routers.paperclip.fetch_paperclip_summary", return_value={"initiative_id": "init-1", "current_tracker_phase": "review"}) as mocked_fetch:
            response = self.client.get("/paperclip/summary/203")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["initiative_id"], "init-1")
        mocked_fetch.assert_called_once_with(203)

    def test_end_to_end_smoke_fetches_live_paperclip_summary(self) -> None:
        server = self._start_fake_server()
        with patch.dict(os.environ, {"PAPERCLIP_BASE_URL": f"http://127.0.0.1:{server.server_port}"}, clear=False):
            response = self.client.get("/paperclip/summary/203")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["goal_id"], "goal_paperclip_papzincrew_001")
        self.assertEqual(body["initiative_id"], "init_paperclip_phase1_mobile_publish_clarity")
        self.assertEqual(body["current_tracker_phase"], "review")
        self.assertEqual(body["storage_flag"], "healthy")

    def test_fetch_paperclip_summary_uses_local_server(self) -> None:
        server = self._start_fake_server()
        summary = fetch_paperclip_summary(203, base_url=f"http://127.0.0.1:{server.server_port}")
        self.assertEqual(summary["initiative_title"], "Mobile publish-state clarity")
        self.assertEqual(summary["linked_tracker_cards"], ["#203", "#204"])


if __name__ == "__main__":
    unittest.main()
