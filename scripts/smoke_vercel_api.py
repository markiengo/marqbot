"""Smoke test for Vercel file-based API functions.

Mimics how Vercel's Python runtime loads api/*.py (spec_from_file_location)
and asserts each route returns JSON, not the SPA index.html fallback.
"""
import importlib.util
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_DIR = os.path.join(ROOT, "api")

# (file, method, path hit by the client, json body)
CASES = [
    ("courses.py", "GET", "/api/courses", None),
    ("programs.py", "GET", "/api/programs", None),
    ("program-buckets.py", "GET", "/api/program-buckets?programs=", None),
    ("recommend.py", "POST", "/api/recommend", {}),
    ("replan.py", "POST", "/api/replan", {}),
    ("can-take.py", "POST", "/api/can-take", {}),
    ("validate-prereqs.py", "POST", "/api/validate-prereqs", {}),
    ("feedback.py", "POST", "/api/feedback", {}),
    ("health.py", "GET", "/api/health", None),
    ("index.py", "GET", "/api", None),  # bare /api: expected to serve SPA HTML
]


def load_module(filename):
    name = "vercel_fn_" + filename.replace("-", "_").replace(".", "_")
    spec = importlib.util.spec_from_file_location(
        name, os.path.join(API_DIR, filename)
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def is_html(res):
    return res.data[:20].lstrip().startswith(b"<!DOCTYPE") or b"<html" in res.data[:200]


def main():
    failures = []
    for filename, method, path, body in CASES:
        mod = load_module(filename)
        client = mod.app.test_client()
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json=body)
        ct = res.headers.get("Content-Type", "")
        html = is_html(res)
        json_ok = "json" in ct
        try:
            res.get_json()
            parseable = True
        except Exception:
            parseable = False
        # Bare /api is allowed to serve the SPA HTML; every real endpoint must be JSON.
        if path == "/api":
            ok = html  # documents current SPA-fallback behavior
        else:
            ok = json_ok and parseable and not html
        status = "OK" if ok else "FAIL"
        print(f"{status} {filename:22} {method:4} {path:35} -> {res.status_code} {ct}")
        if not ok:
            failures.append(filename)

    # Reproduce the OLD bug: rewritten PATH_INFO /api hit the SPA fallback.
    mod = load_module("index.py")
    res = mod.app.test_client().get("/api")
    if is_html(res) and res.status_code == 200:
        print("OK old-bug repro: /api served index.html (200) — this is what the rewrite caused")
    else:
        print("NOTE: /api no longer serves HTML — fallback behavior changed")

    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
