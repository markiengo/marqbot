from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from ensure_frontend_build import ensure_frontend_build

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ENTRYPOINT = REPO_ROOT / "backend" / "server.py"


def run_local() -> int:
    status = ensure_frontend_build()
    if status != 0:
        return status

    if not BACKEND_ENTRYPOINT.is_file():
        print(
            f"[run-local] ERROR: backend entrypoint missing: {BACKEND_ENTRYPOINT}",
            file=sys.stderr,
            flush=True,
        )
        return 1

    print("[run-local] Starting backend server...", flush=True)
    try:
        proc = subprocess.run([sys.executable, str(BACKEND_ENTRYPOINT)], cwd=str(REPO_ROOT))
        return proc.returncode
    except KeyboardInterrupt:
        print("\n[run-local] Stopped by user.", flush=True)
        return 130


def main() -> int:
    return run_local()


if __name__ == "__main__":
    raise SystemExit(main())
