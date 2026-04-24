.PHONY: install start stop help

help:
	@echo ""
	@echo "  MockAPI — Commandes disponibles"
	@echo ""
	@echo "  make install   → Installation du projet (première fois)"
	@echo "  make start     → Lancer MockAPI"
	@echo "  make stop      → Arrêter tous les conteneurs"
	@echo ""

install:
	@echo "→ Installation des dépendances..."
	docker run --rm -it \
		-v $(PWD):/app \
		-w /app \
		node:20 \
		sh -c "rm -rf node_modules package-lock.json && npm install && npm install express cors @monaco-editor/react"
	@echo "✓ Installation terminée"

start:
	@echo "→ Démarrage de MockAPI..."
	docker run --rm -it \
		-v $(PWD):/app \
		-v /home:/home \
		-w /app \
		-p 5173:5173 \
		-p 3001:3001 \
		node:20 \
		sh -c "node server.cjs & npm run dev -- --host"

stop:
	@docker stop $$(docker ps -q) 2>/dev/null || echo "Aucun conteneur en cours"