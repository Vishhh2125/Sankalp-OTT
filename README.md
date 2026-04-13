# OTT Platform — Backend Foundation

## Prerequisites (install once)

1. **Node.js v20 LTS** — https://nodejs.org
2. **Docker Desktop** — https://docker.com/products/docker-desktop (start it after install)
3. **FFmpeg** — Windows: `winget install Gyan.FFmpeg` | Mac: `brew install ffmpeg`
4. **Git** — you already have this

## First-time setup (one developer does this, others just clone)

```bash
# 1. Clone the repo and go to backend
cd Sankalp-OTT
cd backend

# 2. Start Docker services (PostgreSQL, Redis, MinIO, Meilisearch)
cd ../docker
docker compose -f docker-compose.dev.yml up -d
cd ../backend

# 3. Wait 10 seconds for PostgreSQL to be ready, then:

# 4. Install Node dependencies
npm install

# 5. Generate Prisma client
npx prisma generate

# 6. Create all database tables
npx prisma migrate dev --name init

# 7. Seed default data (admin user, categories, tags, coin rules, plans)
npm run db:seed

# 8. Create MinIO bucket for file storage
npm run minio:setup

# 9. Start the API server
npm run dev
```

You should see:
```
Database connected
OTT API running on http://localhost:3000/api
```

## Test it

Open browser: http://localhost:3000/api/health

You should get: `{ "status": "ok", "timestamp": "...", "uptime": ... }`

## Other developers (after first-time setup is pushed)

```bash
git pull
cd docker
docker compose -f docker-compose.dev.yml up -d
cd ../backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

## Useful commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start API with auto-reload on file changes |
| `npm run db:migrate` | Create new migration after schema changes |
| `npm run db:studio` | Open Prisma Studio (browser DB viewer) at localhost:5555 |
| `npm run db:seed` | Re-run seed data |
| `npm run minio:setup` | Re-create MinIO bucket |
| `docker compose -f docker/docker-compose.dev.yml up -d` | Start Docker services |
| `docker compose -f docker/docker-compose.dev.yml down` | Stop Docker services |
| `docker compose -f docker/docker-compose.dev.yml logs -f` | View Docker logs |

## Services running after setup

| Service | URL | Credentials |
|---------|-----|-------------|
| API | http://localhost:3000/api | — |
| PostgreSQL | localhost:5432 | ottdev / ottdev123 / ott_dev |
| Redis | localhost:6379 | — |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin123 |
| MinIO API | http://localhost:9000 | — |
| Meilisearch | http://localhost:7700 | key: devmasterkey123 |
| Prisma Studio | http://localhost:5555 | (run `npm run db:studio`) |

## Default seed data

- **Admin login**: admin@ott.com / Admin@123
- **Categories**: Popular, New, Rankings, Anime, VIP
- **Tags**: Romance, CEO, Revenge, Comedy, Thriller, etc (14 tags)
- **Coin rules**: Day 1-7 check-in rewards (10,10,20,20,25,30,50)
- **Plans**: Weekly ₹49, Monthly ₹149, Annual ₹999
- **CMS pages**: Privacy Policy, Terms, About Us, FAQ

## Project structure

```
backend/
  src/
    modules/
      auth/           # register, login, guest, refresh (YOUR TEAMMATE IS HERE)
      users/          # profile, membership status, block
      content/        # shows, episodes, categories, tags, home, feed
      coins/          # wallet, transactions, daily check-in, unlock
      payments/       # Nation Link gateway, webhooks
      media/          # upload, transcode trigger, presigned URLs
      notifications/  # FCM push, in-app
      search/         # Meilisearch sync + query
      analytics/      # dashboard aggregations
      banners/        # homepage banners
      playlists/      # user playlists, bookmarks, My List
      ratings/        # show ratings
      admin/          # admin CRUD, sub-admin management
    middleware/
      auth.middleware.js     # requireAuth, allowGuest (DONE)
      admin.middleware.js    # requireAdmin with section check (DONE)
      validate.middleware.js # Joi validation (DONE)
      error.middleware.js    # AppError + global handler (DONE)
    config/
      index.js       # env var loader (DONE)
      redis.js       # Redis client (DONE)
      minio.js       # MinIO client (DONE)
      minio-setup.js # Bucket creation script (DONE)
    utils/
      jwt.js          # token generation + verification (DONE)
      password.js     # bcrypt hash + compare (DONE)
      presigned-url.js # MinIO presigned URLs (DONE)
    prisma/
      schema.prisma   # all 22 tables (DONE)
      client.js       # Prisma singleton (DONE)
      seed.js         # default data (DONE)
    app.js            # Express app + routes (DONE)
    server.js         # HTTP listen (DONE)
```

## How to add a new module (e.g. auth)

Each module has 4 files:
```
modules/auth/
  auth.router.js      # Express Router with routes
  auth.controller.js   # Request handlers (req, res, next)
  auth.service.js      # Business logic (talks to Prisma)
  auth.validation.js   # Joi schemas for request bodies
```

After creating the files, uncomment the route in `src/app.js`:
```js
app.use('/api/auth', require('./modules/auth/auth.router'));
```
## To  run worker- 
npm run worker

## To clear jobs 
node -e "const { Queue } = require('bullmq'); const q = new Queue('transcode',{connection:{host:'127.0.0.1',port:6379}}); q.obliterate({force:true}).then(()=>{console.log('cleared'); process.exit();});"

## to change shcema
npx prisma migrate dev --name add_feed_position
npx prisma migrate deploy

## to view the db
npx prisma studio

## test for you
http://localhost:3000/api/feed/for-you

## example
http://localhost:3000/api/media/hls/feba0bad-8f32-455c-80bc-71dc60eecf46/bd710e6b-778f-48cd-a511-82e62e82f7cd/master.m3u8