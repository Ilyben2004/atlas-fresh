# Atlas Fresh

Daily apple export allocation dashboard: upload a Farms / Clients / Station Excel workbook, run the allocation engine, and review Overview, Production, Commercial, and Ledger views. An optional AI Plan Assistant answers three approved plan questions via Gemini.

## Prerequisites

- Docker and Docker Compose
- An Excel workbook with **Farms**, **Clients**, and **Station** sheets

## Run with Docker

```bash
# 1. Environment (optional AI key)
cp .env.example .env
# Edit .env and set GEMINI_API_KEY if you want the live AI assistant.
# Leave GEMINI_API_KEY empty to disable the AI assistant (a clear error is shown).

# 2. Build and start
docker compose up --build
```

Open:

| Service  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:3000        |
| Backend  | http://localhost:8000        |
| Health   | http://localhost:8000/health |
| API docs | http://localhost:8000/docs   |

Stop:

```bash
docker compose down
```

Rebuild after dependency changes:

```bash
docker compose build
docker compose up -d
```

## Environment variables

Copy `.env.example` to `.env` in the repo root:

| Variable         | Purpose                                      | Default              |
|------------------|----------------------------------------------|----------------------|
| `GEMINI_API_KEY` | Google Gemini API key for the Plan Assistant | empty (assistant disabled) |
| `GEMINI_MODEL`   | Gemini model name                            | `gemini-3.6-flash`   |

## Using the app

1. Open http://localhost:3000  
2. Upload an Excel workbook (Farms + Clients + Station)  
3. Browse Overview, Production, Commercial, Ledger  
4. Optionally edit sheets under **Inputs**, then **Save** and **Plan**  
5. Open AI Plan Assistant and pick one of the three approved questions  

## Tests

```bash
docker compose up -d backend
docker compose exec backend python -m pytest -q
```

Use `python -m pytest` (not bare `pytest`). After changing `backend/requirements.txt`, rebuild first:

```bash
docker compose build backend
docker compose up -d backend
docker compose exec backend python -m pytest -q
```

## AI tools and time spent

| Tool | Role |
|------|------|
| **Stitch by Google** | AI design tool used for frontend visual design |
| **Cursor** | Coding assistant used while implementing and testing |

Approximate time spent:

- **3 hours** — understanding the problem, making notes, and brainstorming the theory solution  
- **1 hour** — designing the frontend with Stitch by Google  
- **7 hours** — coding and testing  

**Total: about 11 hours**
