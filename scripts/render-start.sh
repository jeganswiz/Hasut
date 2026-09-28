#!/bin/bash

# Render Start Script for API Service
# Starts the NestJS API with proper error handling

set -e

echo "==== Starting Hasut API Service ===="
echo "Node Environment: $NODE_ENV"
echo "Node Version: $(node --version)"

# Wait for database to be ready (if using PostgreSQL)
if [ -n "$DATABASE_URL" ]; then
  echo "Waiting for database..."
  for i in {1..30}; do
    if nc -z $(echo $DATABASE_URL | grep -oP '(?<=//)\K[^:]+') $(echo $DATABASE_URL | grep -oP '(?<=:)\d+' | tail -1) 2>/dev/null; then
      echo "Database is ready"
      break
    fi
    if [ $i -eq 30 ]; then
      echo "Database connection timeout"
      exit 1
    fi
    echo "Waiting for database... ($i/30)"
    sleep 2
  done
fi

# Start the API
echo ""
echo "Starting API server..."
cd apps/api
node dist/main.js
