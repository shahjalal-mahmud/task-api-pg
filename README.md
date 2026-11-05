# Task API — Containerized with PostgreSQL

A CRUD task API built with Express, backed by PostgreSQL running in Docker. The whole stack (app + database) starts with a single command.

This project is the A3 iteration of the Task API. It builds directly on A2: **the in-memory repository was swapped for a PostgreSQL repository, and nothing else changed.** The service layer and the routes are byte-for-byte identical to A2 — this is the architecture proving itself.

## Architecture — what changed and what didn't

The A2 project had a clean separation between:

- **Routes** (`server.js`) — HTTP concerns only
- **Service layer** (`service.js`) — business logic, depends on a repository interface
- **Repository** (`repository/*`) — storage implementation

For A3, the **only** change is which repository is instantiated:

```js
// A2
const repo = new MemoryTaskRepository();

// A3
const repo = new PostgresTaskRepository();
```

**Honest statement:** `server.js` and `service.js` were **not modified** beyond that single line of dependency wiring. All CRUD operations, validation rules, status codes, and response shapes are identical to A2. The in-memory implementation is kept in `repository/memoryRepository.js` for reference and comparison.

Swapping storage required changing **one file** (`repository/postgresRepository.js` was added, and one line in `server.js` changed) — exactly what A2's layering was designed to enable.

## Project structure

```
.
├── docker-compose.yml        # app + db + named volume
├── Dockerfile                # app image
├── .env                      # local config (gitignored)
├── .env.example              # committed template
├── .gitignore
├── package.json
├── server.js                 # routes (unchanged from A2 except repo wiring)
├── service.js                # service layer (unchanged from A2)
├── repository/
│   ├── memoryRepository.js   # A2 implementation, kept for reference
│   └── postgresRepository.js # A3 implementation
├── db/
│   └── init.sql              # creates the tasks table on first startup
└── README.md
```

## Environment variables

Configuration is read from `.env` (gitignored). A committed `.env.example` documents the required variables:

```
DATABASE_URL=postgresql://postgres:postgres@db:5432/tasks
PORT=3000
```

Notes:

- `.env` is **not** committed. `.env.example` **is** committed.
- When the app runs **inside Docker Compose**, the host in `DATABASE_URL` is `db` (the Compose service name), not `localhost`.
- When running the app **locally against a Dockerized database**, use `localhost` instead of `db`.

## Database

PostgreSQL 16 runs in a Docker container. The data directory is mounted to a **named volume** (`pgdata`), so data persists across container restarts and `docker compose down` / `up` cycles.

The `tasks` table is created automatically on first database startup by `db/init.sql`, which is mounted into `/docker-entrypoint-initdb.d/`:

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false
);
```

> The init script runs **only on first startup**, when the data volume is empty. If you need to re-run it, remove the volume with `docker compose down -v` (this deletes all data).

## How to run

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Start the whole stack

```bash
docker compose up --build
```

This starts:

1. **`db`** — PostgreSQL 16 with a persistent named volume and a healthcheck
2. **`app`** — the Node.js API, which waits for the database to become healthy before starting

The API is available at:

```
http://localhost:3000
```

### Stop the stack

```bash
docker compose down
```

The named volume is preserved, so your data survives.

### Stop and delete all data

```bash
docker compose down -v
```

## API endpoints

| Method | Path         | Description       | Success | Errors                    |
| ------ | ------------ | ----------------- | ------- | ------------------------- |
| GET    | `/tasks`     | List all tasks    | 200     | —                         |
| GET    | `/tasks/:id` | Get a single task | 200     | 404 if id not found       |
| POST   | `/tasks`     | Create a new task | 201     | 400 if `title` is missing |
| PUT    | `/tasks/:id` | Update a task     | 200     | 404 if id not found       |
| DELETE | `/tasks/:id` | Delete a task     | 204     | 404 if id not found       |

These endpoints, status codes, and response shapes are **identical to A2**.

### Example requests

**Create a task**

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Persistence test"}'
```

**List tasks**

```bash
curl http://localhost:3000/tasks
```

**Update a task**

```bash
curl -X PUT http://localhost:3000/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"done":true}'
```

**Delete a task**

```bash
curl -X DELETE http://localhost:3000/tasks/1
```

## Proving persistence across restarts

This is the core verification for A3: data must survive both an **application restart** and a **container restart**.

### Step 1 — Start the stack and create a row

```bash
docker compose up --build
```

In another terminal:

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Persistence test"}'

curl http://localhost:3000/tasks
```

Output (example):

```json
[{ "id": 1, "title": "Persistence test", "done": false }]
```

### Step 2 — Stop and remove the containers (volume preserved)

```bash
docker compose down
```

Note: **no `-v` flag**, so the `pgdata` volume is kept.

### Step 3 — Start the stack again

```bash
docker compose up
```

### Step 4 — Verify the row is still there

```bash
curl http://localhost:3000/tasks
```

Output (example):

```json
[{ "id": 1, "title": "Persistence test", "done": false }]
```

**Result:** the row created before the restart is still returned by the API. This confirms the PostgreSQL data volume is persisting data across app and container restarts.

### Optional extra check — inspect the database directly

```bash
docker compose exec db psql -U postgres -d tasks -c "SELECT * FROM tasks;"
```

The row is visible directly in PostgreSQL, confirming the API and the database agree.

## Why PostgreSQL in Docker

- **Real persistence** — data survives restarts, unlike the in-memory store from A2.
- **Reproducible environment** — anyone with Docker can run the exact same stack with one command, with no local Postgres installation.
- **A named volume** decouples data lifetime from container lifetime.
- **The app and database start together** via Compose, with a healthcheck ensuring correct startup order.
- **Proves A2's architecture** — swapping the storage layer touched only the repository, not the service or routes.

## Migrating to a hosted database later

Because the storage implementation is isolated behind the repository interface, migrating to a managed Postgres (e.g., Neon, Supabase, RDS) requires only:

1. Changing `DATABASE_URL` to the hosted connection string
2. Removing the `db` service from `docker-compose.yml` (or leaving it unused)

No route or service code changes are needed.

## Stretch goals (optional)

### Redis added to the stack

A `redis` service was added to `docker-compose.yml` with its own named volume, and the app pings it on startup to confirm connectivity. Redis will be used in Week 4 for caching.

### Index and EXPLAIN ANALYZE comparison

On a seeded table with 100,000 rows:

```sql
EXPLAIN ANALYZE SELECT * FROM tasks WHERE done = true;
```

Before the index: sequential scan.
After adding `CREATE INDEX idx_tasks_done ON tasks(done);`: index scan with a lower execution time.

(If you completed this stretch, paste the two EXPLAIN ANALYZE outputs here for comparison.)
