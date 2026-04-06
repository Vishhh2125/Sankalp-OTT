# Backend Setup Guide

Production-grade Node.js + Express + Prisma + PostgreSQL backend

## 📋 Project Structure

```
backend/
├── config/
│   ├── database.js          # Prisma client & connection pooling
│   ├── env.js               # Environment validation
│   └── logger.js            # Production logging
├── middleware/              # Express middleware
├── modules/                 # Feature modules
├── utils/                   # Utility functions
├── prisma/
│   └── schema.prisma        # Database schema
├── logs/                    # Application logs (gitignored)
├── app.js                   # Express app setup
├── server.js                # Server entry point
├── .env                     # Environment variables (gitignored)
├── .env.example             # Environment template
└── package.json
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update values:

```bash
DATABASE_URL="postgresql://postgres:admin123@localhost:5432/ott_db"
NODE_ENV="development"
PORT=3000
DEBUG_QUERIES=false
```

### 3. Setup Database

Generate Prisma client:
```bash
npm run generate
```

Run migrations:
```bash
npm run migrate
```

### 4. Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:3000`

## 📊 Available Scripts

- `npm run dev` - Start development server
- `npm run migrate` - Run database migrations
- `npm run generate` - Generate Prisma client
- `npm run studio` - Open Prisma Studio
- `npm test` - Run tests (to be configured)

## 🏥 Health Check

Test database connectivity:

```bash
curl http://localhost:3000/health
```

Response (healthy):
```json
{
  "success": true,
  "status": "OK",
  "timestamp": "2024-04-03T...",
  "database": {
    "status": "healthy",
    "message": "Database is responding normally"
  },
  "environment": "development"
}
```

## 🔒 Production-Grade Features

### ✅ Database Connection Management
- Single Prisma client instance (connection pooling)
- Automatic connection monitoring
- Health check endpoint
- Graceful disconnection

### ✅ Error Handling
- Global error handler middleware
- Uncaught exception handling
- Unhandled promise rejection handling
- Structured error responses

### ✅ Logging
- File-based logging (development & production)
- Multiple log levels: ERROR, WARN, INFO, DEBUG
- Request logging with duration tracking
- Timestamp and structured metadata

### ✅ Graceful Shutdown
- SIGTERM/SIGINT signal handling
- 30-second shutdown timeout
- Proper database disconnection
- Open connection cleanup

### ✅ Environment Validation
- Required environment variables validation
- Invalid NODE_ENV detection
- Configuration logging (with redacted secrets)

### ✅ Request Tracking
- Unique request IDs
- Request duration logging
- HTTP method and path logging

## 📝 Prisma Schema

Edit `prisma/schema.prisma` to define your models:

```prisma
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

After updating schema:
```bash
npm run generate
npm run migrate
```

## 🗂️ Database Logging

Logs are stored in `logs/` directory:
- `error.log` - Error level logs
- `warn.log` - Warning level logs
- `info.log` - Info level logs
- `debug.log` - Debug level logs (dev only)
- `combined.log` - All logs combined

## 🔧 Configuration

### Enable Query Logging (Development)

```bash
DEBUG_QUERIES=true npm run dev
```

### Change Environment

```bash
NODE_ENV=production npm run dev
```

## 🛡️ Security Best Practices Implemented

1. **Secrets Management** - Environment variables via `.env`
2. **Error Exposure** - Sanitized errors in production
3. **Connection Pooling** - Efficient database resource usage
4. **Graceful Degradation** - Service continues on transient failures
5. **Request Logging** - Audit trail of all requests
6. **Signal Handling** - Clean shutdown on termination signals

## 📚 Database Connection Details

- **Provider**: PostgreSQL
- **URL**: `postgresql://user:password@host:port/dbname`
- **Pooling**: Managed by Prisma Client
- **Timeout**: 30 seconds for graceful shutdown

## 🐛 Troubleshooting

### Database Connection Failed
```
✗ Database connection failed
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Ensure PostgreSQL is running and DATABASE_URL is correct

### Missing Environment Variables
```
Missing required environment variables: DATABASE_URL, NODE_ENV
```
**Solution**: Create `.env` file with all required variables (copy from `.env.example`)

### Prisma Client Not Found
```
Error: Cannot find module '@prisma/client'
```
**Solution**: Run `npm install` and `npm run generate`

## 📞 Support

For production issues, check:
1. Log files in `logs/` directory
2. Database health: GET `/health`
3. Environment variables: NODE_ENV, DATABASE_URL, PORT
4. PostgreSQL server status
