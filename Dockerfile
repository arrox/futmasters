# syntax=docker/dockerfile:1.7

# Stage 1: build frontend → dist/
FROM docker.io/node:20-alpine AS web-build
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Stage 2: runtime: backend + dist
FROM docker.io/python:3.12-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./

# Frontend bundle servido por FastAPI como static (app.main usa StaticFiles
# en /app/static — verificado en pre-flight).
COPY --from=web-build /web/dist ./static

EXPOSE 8110
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8110"]
