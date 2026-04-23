.PHONY: help dev dev-backend dev-frontend install test backend-test build clean

help:
	@echo "Comandos disponibles:"
	@echo "  make install       Instala dependencias de backend y frontend"
	@echo "  make dev           Levanta backend (:8000) y frontend (:5173) en paralelo"
	@echo "  make dev-backend   Solo backend con reload"
	@echo "  make dev-frontend  Solo frontend"
	@echo "  make test          Ejecuta tests del backend"
	@echo "  make build         Build de producción del frontend"
	@echo "  make clean         Borra venv, node_modules y DB de desarrollo"

install:
	cd backend && python3 -m venv .venv && .venv/bin/pip install --upgrade pip && .venv/bin/pip install -r requirements.txt
	cd frontend && npm install

dev:
	@echo "→ Levantando backend y frontend. Ctrl+C para detener ambos."
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) -j 2 dev-backend dev-frontend

dev-backend:
	cd backend && ./run.sh

dev-frontend:
	cd frontend && npm run dev

test backend-test:
	cd backend && .venv/bin/python -m pytest tests/ -v

build:
	cd frontend && npm run build

clean:
	rm -rf backend/.venv backend/fc26_sorteo.db
	rm -rf frontend/node_modules frontend/dist
