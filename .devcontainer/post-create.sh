#!/usr/bin/env bash
# Runs once after the Codespace container is created.
set -euo pipefail

# Volume for Claude Code config is created root-owned.
sudo chown -R node:node /home/node/.claude

# Angular CLI and SonarScanner CLI (`sonar` command).
npm install -g @angular/cli @sonar/scan

# SonarQube MCP server for Claude Code (runs on the Java 21 installed by the devcontainer feature).
SONAR_MCP_VERSION="1.28.0.4397"
SONAR_MCP_DIR="/home/node/.local/share/sonarqube-mcp"
mkdir -p "$SONAR_MCP_DIR/storage"
curl -fsSL -o "$SONAR_MCP_DIR/sonarqube-mcp-server.jar" \
  "https://binaries.sonarsource.com/Distribution/sonarqube-mcp-server/sonarqube-mcp-server-${SONAR_MCP_VERSION}.jar"

# Development key for encrypting the SMTP password stored on the Settings page (ADR 0006).
if ! grep -q 'SETTINGS_KEY=' ~/.bashrc; then
  echo "export SETTINGS_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")" >> ~/.bashrc
fi

if [ -f Domusmea/package.json ]; then
  npm install --prefix Domusmea
fi

# Chromium for the Playwright MCP server (Debian bookworm: install libraries directly, as
# `playwright install-deps` references font packages bookworm does not have).
sudo apt-get update -qq
sudo apt-get install -y -qq --no-install-recommends libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
  libdbus-1-3 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libxkbcommon0 libasound2 \
  libpango-1.0-0 libcairo2 libcups2 libdrm2 libatspi2.0-0 fonts-liberation
mkdir -p ~/.cache/ms-playwright/.links
npx -y -p @playwright/mcp@0.0.82 playwright install chromium
