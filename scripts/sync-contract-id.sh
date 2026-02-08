#!/bin/bash
# Reads the deployed contract ID from contracts/.contract_id
# and updates the root .env file used by docker-compose.
# Run after: docker exec -it impacta-soroban-dev bash -c "make deploy"

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONTRACT_FILE="$ROOT_DIR/contracts/.contract_id"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$CONTRACT_FILE" ]; then
    echo "Error: $CONTRACT_FILE not found. Run 'make deploy' in soroban-dev first."
    exit 1
fi

CONTRACT_ID=$(cat "$CONTRACT_FILE" | tr -d '[:space:]')

if [ -z "$CONTRACT_ID" ]; then
    echo "Error: Contract ID is empty."
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
    echo "CONTRACT_ID=$CONTRACT_ID" > "$ENV_FILE"
    echo "Created $ENV_FILE with CONTRACT_ID=$CONTRACT_ID"
    exit 0
fi

# Update or append CONTRACT_ID
if grep -q "^CONTRACT_ID=" "$ENV_FILE"; then
    sed -i "s|^CONTRACT_ID=.*|CONTRACT_ID=$CONTRACT_ID|" "$ENV_FILE"
else
    echo "CONTRACT_ID=$CONTRACT_ID" >> "$ENV_FILE"
fi

echo "Updated CONTRACT_ID=$CONTRACT_ID in $ENV_FILE"
echo "Run 'docker compose restart backend frontend' to apply."
