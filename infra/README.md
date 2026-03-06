# Infrastructure Layout

This repo now groups deploy/runtime assets under `infra/` where possible.

## Paths
- Docker image build: `infra/docker/Dockerfile`
- Render service config: `render.yaml` (root, points to `infra/docker/Dockerfile`)

## Why some files stay at repo root
- `.gitignore` must stay at repo root for Git ignore rules.
- `.dockerignore` must stay at repo root for Docker build-context filtering.
- `.env` / `.env.example` are kept at root for local developer workflow and `load_dotenv()` discovery.
- `render.yaml` is kept at root for Render Blueprint auto-detection.

## Practical rule
Keep infra implementation files in `infra/`, but keep root-level integration entrypoints that external tools expect.
