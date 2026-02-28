# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS frontend_builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY data ./data
COPY --from=frontend_builder /app/frontend/out ./frontend/out

CMD ["sh", "-c", "gunicorn --chdir backend server:app --bind 0.0.0.0:${PORT:-5000} --workers ${WEB_CONCURRENCY:-1} --timeout ${GUNICORN_TIMEOUT:-90} --graceful-timeout ${GUNICORN_GRACEFUL_TIMEOUT:-30}"]
