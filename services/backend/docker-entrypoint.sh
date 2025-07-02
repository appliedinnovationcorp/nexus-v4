#!/bin/sh

set -e

echo "🚀 Starting Nexus Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
until node -e "
const { PrismaClient } = require('./services/backend/dist/prisma/prisma.service.js');
const prisma = new PrismaClient();
prisma.\$connect()
  .then(() => { console.log('✅ Database connected'); process.exit(0); })
  .catch(() => { console.log('❌ Database not ready'); process.exit(1); });
" 2>/dev/null; do
  echo "Database not ready, waiting 2 seconds..."
  sleep 2
done

# Run database migrations
echo "🔄 Running database migrations..."
cd services/backend
npx prisma migrate deploy

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Seed database if needed
if [ "$NODE_ENV" != "production" ]; then
  echo "🌱 Seeding database..."
  npm run seed || echo "⚠️ Seeding failed or not configured"
fi

# Start the application
echo "🎯 Starting application..."
cd /app
exec node services/backend/dist/main.js
