# Images API

Image upload and management REST API with async processing, built with NestJS.

## Quick Start (Docker Compose)

The fastest way to run the full application:

```bash
docker compose --profile app up --build
```

This starts **all services** automatically:

| Service      | Description                          | Port |
| ------------ | ------------------------------------ | ---- |
| **postgres** | PostgreSQL 18 database               | 5432 |
| **redis**    | Redis 8 (BullMQ job queue)           | 6379 |
| **migrate**  | Runs database migrations, then exits | -    |
| **app**      | Images API server                    | 3000 |

The app waits for database and Redis health checks, runs migrations, and starts the server.

Once running, the API is available at **http://localhost:3000/api**.

### API Documentation

OpenAPI (Swagger) docs are available at:

**http://localhost:3000/api/docs**

### Stop & Clean Up

```bash
# Stop all services
docker compose --profile app down

# Stop and remove volumes (wipes database and Redis data)
docker compose --profile app down -v
```

---

## Local Development

### Prerequisites

- Node.js 24 LTS
- PostgreSQL
- Redis

### 1. Start Infrastructure

Start only PostgreSQL and Redis using Docker Compose:

```bash
docker compose up
```

### 2. Configure Environment

Create a `.env` file in the project root:

```dotenv
# Server
PORT=3000

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/images-api?schema=public"

# Storage
STORAGE_PROVIDER=LOCAL
STORAGE_MAX_FILE_SIZE=10485760
STORAGE_BASE_PATH=./uploads
STORAGE_BASE_URL=http://localhost:3000/uploads

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Install Dependencies & Run Migrations

```bash
npm install
npm run migration:run
```

### 4. Start Development Server

```bash
npm run start:dev
```

The API will be available at **http://localhost:3000/api** with Swagger docs at **http://localhost:3000/api/docs**.

---

## S3 Storage Configuration

By default the API stores uploaded images on the local filesystem. To use S3-compatible storage (AWS S3, Backblaze B2, MinIO, etc.), update your `.env`:

```dotenv
STORAGE_PROVIDER=S3

S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

For **S3-compatible providers** (Backblaze B2, MinIO, DigitalOcean Spaces), also set:

```dotenv
S3_ENDPOINT_DOMAIN=backblazeb2.com  # or your provider's domain
```

When using S3 with Docker Compose, update the environment variables in the `app` service in `docker-compose.yml` accordingly.

---

## API Endpoints

All endpoints are prefixed with `/api`.

### `POST /api/images`

Upload an image with optional resizing.

- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `file` — image file (JPEG, PNG, WebP, GIF, TIFF, AVIF, BMP)
  - `title` — image title (required, 1–255 characters)
  - `width` — target width in pixels (optional, 1–7680)
  - `height` — target height in pixels (optional, 1–4320)
- **Max file size:** 10 MB (configurable)

If width/height are provided, the image is processed asynchronously via a background job queue.

### `GET /api/images`

List images with pagination and optional filtering.

- **Query parameters:**
  - `title` — filter by title (contains, case-insensitive)
  - `limit` — items per page (1–100, default: 20)
  - `cursor` — pagination cursor
  - `direction` — `next` or `prev`

### `GET /api/images/:id`

Get a single image by UUID.

### `GET /api/images/events/:id`

Server-Sent Events endpoint for real-time image processing status notifications.

---

## Project Structure

```
src/
├── config/          # App configuration (env variables)
├── database/        # Kysely database service & types
├── images/          # Image upload, processing, and retrieval
│   ├── controllers/ # HTTP controllers
│   ├── dto/         # Request/response DTOs with validation
│   ├── events/      # Domain events (ImageStored, ProcessingFailed)
│   ├── processors/  # BullMQ job processors
│   ├── repositories/# Database repositories
│   └── services/    # Business logic
├── notifications/   # SSE notifications module (event-driven)
├── serve-static/    # Static file serving (local uploads)
└── storage/         # File storage abstraction (Local / S3)

libs/shared/         # Shared interfaces and entities
prisma/              # Prisma schema and migrations
test/                # E2E tests
```

---

## Testing

```bash
# Unit tests
npm test

# Unit tests with coverage
npm run test:cov

# E2E tests (requires mocked dependencies)
npm run test:e2e
```

---

## Tech Stack

- **Runtime:** Node.js 24 LTS
- **Framework:** NestJS 11
- **Database:** PostgreSQL with Prisma (migrations) + Kysely (queries)
- **Queue:** BullMQ + Redis (async image processing)
- **Image Processing:** Sharp
- **Storage:** Local filesystem or S3-compatible
- **API Docs:** OpenAPI v3 (Swagger)
- **Testing:** Jest + Supertest
