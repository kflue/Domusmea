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

if [ -f package.json ]; then
  npm install
fi
