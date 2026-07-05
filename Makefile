.PHONY: help run-mvp run-voice build-docker test clean

help:
	@echo "Makefile for Aranya.ai Monorepo"
	@echo ""
	@echo "Usage:"
	@echo "  make run-mvp        - Run the MVP application locally"
	@echo "  make run-voice      - Run the WhatsApp Voice application locally"
	@echo "  make run-mobile     - Run the Mobile app (Android/iOS)"
	@echo "  make run-web        - Run the Mobile app in the web browser"
	@echo "  make build-docker   - Build the main docker image"
	@echo "  make clean          - Remove Python cache files and temporary artifacts"

run-mvp:
	@echo "Starting MVP Service..."
	cd apps/mvp && python main.py

run-voice:
	@echo "Starting WhatsApp Voice Service..."
	cd apps/whatsapp_voice && python server.py

run-mobile:
	@echo "Starting Mobile App Bundler..."
	cd apps/mobile-client && npm start

run-web:
	@echo "Starting Mobile App in Web Browser..."
	cd apps/mobile-client && npm run web

build-docker:
	docker-compose build

clean:
	@echo "Cleaning up __pycache__ and temp files..."
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	@echo "Clean complete."
