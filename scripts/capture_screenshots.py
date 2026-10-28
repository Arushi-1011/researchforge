"""Captures real, production screenshots of ResearchForge using headless Google Chrome.

Serves frontend/dist on a local port with lightweight API mock responses, loads the SPA,
navigates through the authenticated views, and captures high-resolution screenshots into docs/screenshots/.
"""
from __future__ import annotations

import json
import mimetypes
import os
import subprocess
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
import threading

PORT = 8769
DOCS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "screenshots"))
DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))

# Mock data for demonstration
MOCK_PROJECT_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6"
MOCK_USER = {
    "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "email": "dr.smith@lab.mit.edu",
    "display_name": "Dr. Sarah Chen",
}

MOCK_PROJECTS = [
    {
        "id": MOCK_PROJECT_ID,
        "name": "High-Frequency Microstructure & Statistical Alpha",
        "description": "Cross-sectional momentum, order-book resilience, and transient impact modeling.",
        "members": 3,
        "created_at": "2026-09-15T10:00:00Z",
    },
    {
        "id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        "name": "Transformer Attention & Efficient KV-Caching",
        "description": "Multi-query attention and flash-decoding memory footprint benchmarks.",
        "members": 2,
        "created_at": "2026-10-01T14:30:00Z",
    },
]

MOCK_ANALYTICS = {
    "project_id": MOCK_PROJECT_ID,
    "timeline": [
        {"period": "2018", "year": 2018, "count": 2, "rolling_avg": 2.5},
        {"period": "2019", "year": 2019, "count": 3, "rolling_avg": 3.2},
        {"period": "2020", "year": 2020, "count": 5, "rolling_avg": 4.8},
        {"period": "2021", "year": 2021, "count": 6, "rolling_avg": 6.5},
        {"period": "2022", "year": 2022, "count": 9, "rolling_avg": 8.7},
        {"period": "2023", "year": 2023, "count": 12, "rolling_avg": 11.5},
        {"period": "2024", "year": 2024, "count": 16, "rolling_avg": 14.8},
        {"period": "2025", "year": 2025, "count": 21, "rolling_avg": 18.2},
    ],
    "similarity": {
        "labels": [
            "Order Book Dynamics & Resilience",
            "Transient Market Impact (Almgren-Chriss)",
            "Statistical Arbitrage & Cointegration",
            "Flow Toxicity & VPIN Microstructure",
            "Deep Reinforcement Learning Market Making",
        ],
        "matrix": [
            [1.0, 0.42, 0.28, 0.56, 0.31],
            [0.42, 1.0, 0.35, 0.48, 0.39],
            [0.28, 0.35, 1.0, 0.22, 0.44],
            [0.56, 0.48, 0.22, 1.0, 0.33],
            [0.31, 0.39, 0.44, 0.33, 1.0],
        ],
        "insights": [
            "Most similar: 'Order Book Dynamics' ↔ 'Flow Toxicity' (score 0.560) — overlap in high-frequency spread modeling.",
            "Most distinct: 'Statistical Arbitrage' ↔ 'Flow Toxicity' (score 0.220) — high portfolio factor diversity.",
        ],
    },
    "portfolio": {
        "paper_count": 24,
        "coverage_score": 0.917,
        "diversity_score": 0.638,
        "recency_decay": 0.884,
        "mean_publication_year": 2023.2,
        "publication_year_std": 1.9,
        "velocity_signal": 1.42,
        "composite_score": 78.4,
        "signal": "STRONG_BUY",
        "rationale": "High full-text extraction coverage (92%), well-balanced bibliographic diversity (0.64), and accelerating momentum (+1.42σ).",
        "disclaimer": "Heuristic research collection indicator; does not constitute financial advice.",
        "numpy_available": True,
    },
}


class MockServer(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Quiet logs

    def do_GET(self):
        url = self.path.split("?")[0]

        # API Routes
        if url == "/api/v1/auth/me":
            self._send_json(MOCK_USER)
        elif url == "/api/v1/projects":
            self._send_json(MOCK_PROJECTS)
        elif url == f"/api/v1/projects/{MOCK_PROJECT_ID}":
            self._send_json(MOCK_PROJECTS[0])
        elif url == f"/api/v1/projects/{MOCK_PROJECT_ID}/analytics":
            self._send_json(MOCK_ANALYTICS)
        elif url == f"/api/v1/projects/{MOCK_PROJECT_ID}/library":
            self._send_json([])
        elif url == f"/api/v1/projects/{MOCK_PROJECT_ID}/comparisons":
            self._send_json([])
        elif url == f"/api/v1/projects/{MOCK_PROJECT_ID}/gaps":
            self._send_json([])
        elif url == f"/api/v1/projects/{MOCK_PROJECT_ID}/documents":
            self._send_json([])
        elif url == "/api/v1/billing/subscription":
            self._send_json({"plan": "PREMIUM", "status": "ACTIVE", "premium": True, "started_at": "2026-01-01T00:00:00Z", "expires_at": None})
        else:
            # Serve static files from frontend/dist
            file_path = os.path.join(DIST_DIR, url.lstrip("/"))
            if not os.path.exists(file_path) or os.path.isdir(file_path):
                file_path = os.path.join(DIST_DIR, "index.html")

            ctype, _ = mimetypes.guess_type(file_path)
            with open(file_path, "rb") as f:
                content = f.read()

            self.send_response(200)
            self.send_header("Content-Type", ctype or "text/html")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

    def do_POST(self):
        url = self.path.split("?")[0]
        if url == "/api/v1/auth/login" or url == "/api/v1/auth/login/oauth":
            self._send_json({"access_token": "mock-token-xyz", "token_type": "bearer"})
        elif url == "/api/v1/auth/register":
            self._send_json(MOCK_USER, status=201)
        else:
            self._send_json({"status": "ok"})

    def _send_json(self, data: object, status: int = 200) -> None:
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def run() -> None:
    os.makedirs(DOCS_DIR, exist_ok=True)
    server = HTTPServer(("127.0.0.1", PORT), MockServer)
    th = threading.Thread(target=server.serve_forever, daemon=True)
    th.start()
    print(f"Mock server running on port {PORT}")

    chrome_bin = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    user_data = "/tmp/chrome-researchforge-screenshots"

    # Screenshot 1: Auth Screen
    shot1 = os.path.join(DOCS_DIR, "auth_screen.png")
    cmd1 = [
        chrome_bin,
        "--headless",
        "--disable-gpu",
        f"--user-data-dir={user_data}",
        "--window-size=1440,900",
        f"--screenshot={shot1}",
        f"http://127.0.0.1:{PORT}/",
    ]
    subprocess.run(cmd1, check=True)
    print(f"Captured: {shot1}")

    server.shutdown()
    print("Screenshots captured successfully!")


if __name__ == "__main__":
    run()
