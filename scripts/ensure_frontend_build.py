from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = REPO_ROOT / "frontend"
FRONTEND_OUT_INDEX = FRONTEND_DIR / "out" / "index.html"
NODE_MODULES_DIR = FRONTEND_DIR / "node_modules"


def _run(command: list[str], cwd: Path) -> None:
    print(f"[build-guard] Running: {' '.join(command)} (cwd={cwd})", flush=True)
    subprocess.run(command, cwd=str(cwd), check=True)


def ensure_frontend_build() -> int:
    if FRONTEND_OUT_INDEX.is_file():
        print(f"[build-guard] Frontend export is ready: {FRONTEND_OUT_INDEX}", flush=True)
        return 0

    if not FRONTEND_DIR.is_dir():
        print(f"[build-guard] ERROR: frontend directory missing: {FRONTEND_DIR}", file=sys.stderr, flush=True)
        return 1

    npm_executable = shutil.which("npm") or shutil.which("npm.cmd")
    if npm_executable is None:
        print("[build-guard] ERROR: npm was not found on PATH.", file=sys.stderr, flush=True)
        return 1

    print("[build-guard] Frontend export missing. Building frontend...", flush=True)
    try:
        if not NODE_MODULES_DIR.is_dir():
            _run([npm_executable, "ci"], FRONTEND_DIR)
        else:
            print("[build-guard] node_modules found, skipping npm ci.", flush=True)
        _run([npm_executable, "run", "build"], FRONTEND_DIR)
    except subprocess.CalledProcessError as exc:
        print(
            f"[build-guard] ERROR: command failed with exit code {exc.returncode}.",
            file=sys.stderr,
            flush=True,
        )
        return exc.returncode or 1

    if not FRONTEND_OUT_INDEX.is_file():
        print(
            "[build-guard] ERROR: build completed but frontend/out/index.html was not generated.",
            file=sys.stderr,
            flush=True,
        )
        return 1

    print(f"[build-guard] Frontend export generated: {FRONTEND_OUT_INDEX}", flush=True)
    return 0


def main() -> int:
    return ensure_frontend_build()


if __name__ == "__main__":
    raise SystemExit(main())
