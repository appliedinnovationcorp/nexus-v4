# Local Database Setup Guide

This guide covers the complete local database environment setup for the Nexus workspace, providing database-agnostic solutions with PostgreSQL for relational data and MongoDB for NoSQL data.

## Overview

The Nexus workspace uses a multi-database architecture:

- **PostgreSQL**: Relational data (users, posts, structured content)
- **MongoDB**: NoSQL data (sessions, preferences, analytics, metadata)
- **Redis**: Caching and session storage

All databases run in Docker containers with management tools for easy development.

## Quick Start

### 1. Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ and pnpm installed
- Git for version control

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Review and customize the values in .env
# Default values work for local development
```

### 3. Start Database Services

```bash
# Start all database services
./scripts/db-setup.sh up

# Or use the shorthand
./scripts/db-setup.sh
```

### 4. Verify Setup

```bash
# Check service status
./scripts/db-setup.sh status

# View logs
./scripts/db-setup.sh logs
```

## Database Architecture

### PostgreSQL (Relational Data)

**Purpose**: Structured data with ACID compliance
**Port**: 5432
**Default Database**: `nexus_dev`

**Schema Structure**:
```
├── nexus_core/          # Core application data
├── nexus_auth/          # Authentication and users
├── nexus_content/       # Content management
└── nexus_analytics/     # Analytics and tracking
```

**Key Tables**:
- `nexus_auth.users` - User accounts
- `nexus_auth.user_profiles` - User profile data
- `nexus_auth.sessions` - User sessions
- `nexus_content.posts` - Blog posts and content
- `nexus_analytics.page_views` - Page view tracking

### MongoDB (NoSQL Data)

**Purpose**: Flexible document storage
**Port**: 27017
**Default Database**: `nexus_nosql`

**Collections**:
- `user_sessions` - Session data with TTL
- `user_preferences` - User settings and customizations
- `activity_logs` - User activity tracking
- `content_metadata` - Flexible content attributes
- `analytics_events` - Event tracking data
- `file_uploads` - File metadata and tracking

### Redis (Caching)

**Purpose**: High-performance caching and session storage
**Port**: 6379
**Default Database**: 0

**Usage**:
- Session storage
- API response caching
- Rate limiting
- Real-time data
- Pub/Sub messaging

## Management Tools

### pgAdmin (PostgreSQL)
- **URL**: http://localhost:5050
- **Username**: admin@nexus.local
- **Password**: admin_password
- **Features**: Query editor, schema browser, performance monitoring

### Mongo Express (MongoDB)
- **URL**: http://localhost:8081
- **Username**: admin
- **Password**: admin_password
- **Features**: Document browser, query interface, collection management

### Redis Commander (Redis)
- **URL**: http://localhost:8082
- **Username**: admin
- **Password**: admin_password
- **Features**: Key browser, command interface, monitoring

## Database Setup Script

The `scripts/db-setup.sh` script provides comprehensive database management:

### Commands

```bash
# Start services
./scripts/db-setup.sh up
./scripts/db-setup.sh start

# Stop services
./scripts/db-setup.sh down
./scripts/db-setup.sh stop

# Restart services
./scripts/db-setup.sh restart

# View status
./scripts/db-setup.sh status

# View logs
./scripts/db-setup.sh logs [service]

# Create backups
./scripts/db-setup.sh backup

# Restore from backup
./scripts/db-setup.sh restore <backup_file>

# Reset environment (recreate containers)
./scripts/db-setup.sh reset

# Clean up (removes all data)
./scripts/db-setup.sh clean

# Show help
./scripts/db-setup.sh help
```

### Examples

```bash
# Start with logs
./scripts/db-setup.sh up && ./scripts/db-setup.sh logs

# View PostgreSQL logs only
./scripts/db-setup.sh logs postgres

# Create backup before major changes
./scripts/db-setup.sh backup

# Reset if something goes wrong
./scripts/db-setup.sh reset
```

## Shared Database Package

The `@nexus/shared-database` package provides database-agnostic utilities:

### Installation

```bash
# Already included in workspace
pnpm install
```

### Usage

```typescript
import {
  initializeDatabases,
  checkDatabasesHealth,
  executeQuery,
  mongoOperations,
  redisOperations,
} from '@nexus/shared-database';

// Initialize all databases
await initializeDatabases();

// Check health
const health = await checkDatabasesHealth();

// PostgreSQL query
const users = await executeQuery('SELECT * FROM nexus_auth.users LIMIT 10');

// MongoDB operation
const preferences = await mongoOperations.find('user_preferences', { userId: 'user123' });

// Redis operation
await redisOperations.set('cache:key', 'value', 3600);
```

### Connection Management

```typescript
import {
  getPostgreSQLConnection,
  getMongoDBConnection,
  getRedisConnection,
} from '@nexus/shared-database';

// Get individual connections
const pgConn = getPostgreSQLConnection();
const mongoConn = getMongoDBConnection();
const redisConn = getRedisConnection();

// Use with custom configuration
const customPgConn = getPostgreSQLConnection({
  host: 'custom-host',
  port: 5432,
  database: 'custom_db',
  username: 'custom_user',
  password: 'custom_pass',
});
```

## Environment Variables

### PostgreSQL Configuration

```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=nexus_dev
POSTGRES_USER=nexus_user
POSTGRES_PASSWORD=nexus_password
DATABASE_URL=postgresql://nexus_user:nexus_password@localhost:5432/nexus_dev
```

### MongoDB Configuration

```bash
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_DB=nexus_nosql
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=admin_password
MONGODB_URL=mongodb://admin:admin_password@localhost:27017/nexus_nosql?authSource=admin
```

### Redis Configuration

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_URL=redis://:redis_password@localhost:6379
```

## Data Initialization

### PostgreSQL

The database is automatically initialized with:
- Schema creation (nexus_core, nexus_auth, nexus_content, nexus_analytics)
- Table creation with proper indexes
- Sample data for development
- Triggers for updated_at timestamps
- Extensions (uuid-ossp, pgcrypto, pg_trgm)

### MongoDB

Collections are created with:
- Document validation schemas
- Appropriate indexes for performance
- Sample documents for development
- TTL indexes for session expiration

### Sample Data

Both databases include sample data:
- Admin user account
- Test user accounts
- Sample posts and content
- User preferences and sessions
- Activity logs and analytics events

## Development Workflow

### 1. Daily Development

```bash
# Start databases
./scripts/db-setup.sh up

# Develop your application
pnpm dev

# Stop when done
./scripts/db-setup.sh down
```

### 2. Schema Changes

```bash
# Create backup before changes
./scripts/db-setup.sh backup

# Make your schema changes
# Test thoroughly

# If something goes wrong
./scripts/db-setup.sh restore <backup_file>
```

### 3. Fresh Start

```bash
# Reset everything
./scripts/db-setup.sh reset

# Or clean slate
./scripts/db-setup.sh clean
./scripts/db-setup.sh up
```

## Production Considerations

### Security

- Change all default passwords
- Use environment-specific credentials
- Enable SSL/TLS for connections
- Implement proper network security
- Regular security updates

### Performance

- Configure connection pooling
- Set up proper indexes
- Monitor query performance
- Implement caching strategies
- Regular maintenance tasks

### Backup Strategy

- Automated daily backups
- Point-in-time recovery
- Cross-region backup storage
- Regular restore testing
- Backup retention policies

### Monitoring

- Database performance metrics
- Connection pool monitoring
- Query performance analysis
- Error rate tracking
- Capacity planning

## Troubleshooting

### Common Issues

#### Docker Issues

```bash
# Docker not running
sudo systemctl start docker

# Permission issues
sudo usermod -aG docker $USER
# Log out and back in

# Port conflicts
./scripts/db-setup.sh down
# Change ports in .env
./scripts/db-setup.sh up
```

#### Connection Issues

```bash
# Check service status
./scripts/db-setup.sh status

# View logs for errors
./scripts/db-setup.sh logs

# Test connections
docker exec -it nexus-postgres psql -U nexus_user -d nexus_dev -c "SELECT 1;"
docker exec -it nexus-mongodb mongosh --username admin --password admin_password
docker exec -it nexus-redis redis-cli -a redis_password ping
```

#### Performance Issues

```bash
# Check resource usage
docker stats

# Optimize PostgreSQL
# Edit postgresql.conf in container
# Increase shared_buffers, work_mem

# Optimize MongoDB
# Check slow queries
# Add appropriate indexes

# Optimize Redis
# Monitor memory usage
# Configure maxmemory policy
```

### Health Checks

```bash
# Application health check
curl http://localhost:3001/api/health

# Database health via shared package
node -e "
const { checkDatabasesHealth } = require('@nexus/shared-database');
checkDatabasesHealth().then(console.log);
"
```

### Log Analysis

```bash
# PostgreSQL logs
./scripts/db-setup.sh logs postgres

# MongoDB logs
./scripts/db-setup.sh logs mongodb

# Redis logs
./scripts/db-setup.sh logs redis

# All database logs
./scripts/db-setup.sh logs postgres mongodb redis
```

## Best Practices

### Development

1. **Always use transactions** for multi-table operations
2. **Index frequently queried columns** for performance
3. **Use connection pooling** to manage resources
4. **Validate data** before database operations
5. **Handle errors gracefully** with proper logging

### Schema Design

1. **Normalize relational data** in PostgreSQL
2. **Denormalize document data** in MongoDB appropriately
3. **Use appropriate data types** for efficiency
4. **Plan for scalability** from the beginning
5. **Document schema changes** thoroughly

### Security

1. **Never commit credentials** to version control
2. **Use environment variables** for configuration
3. **Implement proper authentication** and authorization
4. **Sanitize user input** to prevent injection
5. **Regular security audits** and updates

### Performance

1. **Monitor query performance** regularly
2. **Use EXPLAIN** to analyze query plans
3. **Implement caching** for frequently accessed data
4. **Optimize indexes** based on query patterns
5. **Regular maintenance** tasks (VACUUM, REINDEX)

## Integration Examples

### Backend Integration (NestJS)

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { initializeSharedDatabases } from '@nexus/shared-database';

@Module({
  // ... other configuration
})
export class AppModule {
  async onModuleInit() {
    await initializeSharedDatabases();
  }
}

// user.service.ts
import { Injectable } from '@nestjs/common';
import { executeQuery, mongoOperations } from '@nexus/shared-database';

@Injectable()
export class UserService {
  async getUser(id: string) {
    const result = await executeQuery(
      'SELECT * FROM nexus_auth.users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  async getUserPreferences(userId: string) {
    return await mongoOperations.findOne('user_preferences', { userId });
  }
}
```

### Frontend Integration (Next.js)

```typescript
// pages/api/health.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getSharedDatabaseHealth } from '@nexus/shared-database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const health = await getSharedDatabaseHealth();
    res.status(200).json(health);
  } catch (error) {
    res.status(500).json({ error: 'Health check failed' });
  }
}
```

## Conclusion

The Nexus database setup provides a robust, scalable, and developer-friendly environment for local development. The combination of PostgreSQL, MongoDB, and Redis covers all data storage needs while maintaining consistency and performance.

Key benefits:
- **Database Agnostic**: Easy to switch or add databases
- **Developer Friendly**: Simple setup and management
- **Production Ready**: Scalable architecture and best practices
- **Fully Integrated**: Shared utilities across the workspace
- **Well Documented**: Comprehensive guides and examples

For additional help or questions, refer to the individual database documentation or create an issue in the project repository.
