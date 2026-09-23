import os
import sys

# Add backend directory to sys.path so sibling imports work
BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from server import app  # noqa: F401 — Vercel detects this WSGI app
