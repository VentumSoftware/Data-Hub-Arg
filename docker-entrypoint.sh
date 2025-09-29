#!/bin/sh
set -e

echo "Docker entrypoint started..."

# Remove local .env files if they exist (to avoid conflicts with Docker environment variables)
if [ -f /app/.env ]; then
    echo "Removing local .env file to avoid conflicts with Docker environment variables..."
    rm -f /app/.env
fi

if [ -f /app/.env.local ]; then
    echo "Removing local .env.local file..."
    rm -f /app/.env.local
fi

if [ -f /app/.env.development ]; then
    echo "Removing local .env.development file..."
    rm -f /app/.env.development
fi

# Wait for database to be ready (opcional, pero útil)
if [ "$WAIT_FOR_DB" = "true" ]; then
    echo "Waiting for database to be ready..."
    while ! nc -z postgres 5432; do
        sleep 1
    done
    echo "Database is ready!"
fi

# Execute the command passed to the container
echo "Starting application..."
exec "$@"