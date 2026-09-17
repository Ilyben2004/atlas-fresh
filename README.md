# Atlas Fresh

Daily apple export allocation dashboard: upload a Farms / Clients / Station Excel workbook, run the allocation engine, and review Overview, Production, Commercial, Ledger, and editable Inputs. An optional AI Plan Assistant answers three approved plan questions via Gemini when a key is set.

## Prerequisites

- Docker and Docker Compose
- An Excel workbook with **Farms**, **Clients**, and **Station** sheets (baseline workbook used during development)

## Run with Docker

```bash
# 1. Environment (optional AI key)
cp .env.example .env
# Edit .env and set GEMINI_API_KEY if you want the live AI assistant.
# Leave GEMINI_API_KEY empty for no-key mode (labelled deterministic KPI summary).

# 2. Build and start
docker compose up --build
```

Open:


| Service  | URL                                                          |
| -------- | ------------------------------------------------------------ |
| Frontend | [http://localhost:3000](http://localhost:3000)               |
| Backend  | [http://localhost:8000](http://localhost:8000)               |
| Health   | [http://localhost:8000/health](http://localhost:8000/health) |
| API docs | [http://localhost:8000/docs](http://localhost:8000/docs)     |


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

Copy `.env.example` to `.env` in the repo root. **Do not commit** `.env` **or API keys.**


| Variable         | Purpose                                      | Default             |
| ---------------- | -------------------------------------------- | ------------------- |
| `GEMINI_API_KEY` | Google Gemini API key for the Plan Assistant | empty (no-key mode) |
| `GEMINI_MODEL`   | Gemini model name                            | `gemini-3.6-flash`  |




## Using the app

1. Open [http://localhost:3000](http://localhost:3000)
2. Upload an Excel workbook (Farms + Clients + Station)
3. Browse Overview, Production, Commercial, Ledger
4. Optionally edit sheets under **Inputs**, then **Save** and **Plan**
5. Open AI Plan Assistant: with a key, Gemini answers the three approved questions from plan data; without a key, a labelled deterministic summary is shown



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

Coverage includes allocation policy, validation constraints, JSON replan, and assistant boundaries (grounded IDs, unsupported reject, provider failure, no-key).

## Architecture

```
Excel / Inputs editor
        │
        ▼
FastAPI (validation → greedy allocation engine → KPIs / views / ledger)
        │
        ├── REST: POST /api/v1/plan (Excel), POST /api/v1/plan/json (edited inputs)
        └── REST: POST /api/v1/chat (Gemini tool data + LLM answer when keyed)
        │
        ▼
React SPA (Overview, Inputs, Production, Commercial, Ledger, AI Assistant)
```

- **Planning is deterministic and server-side** (price order, EXACT/MINIMUM, 5 t steps, station cap, local residual). The LLM never reallocates.
- **Frontend** is a Vite + React SPA; **backend** is FastAPI + pandas/openpyxl for Excel ingest.



## Limitations

- No auth, DB, multi-day optimizer, logistics, or live deployment in this delivery.
- Assistant is limited to three analytical intents; off-topic questions are rejected.





## AI tools, verification, time spent, intentional omissions


| Tool                 | Role                                             |
| -------------------- | ------------------------------------------------ |
| **Stitch by Google** | AI design tool for frontend visual direction     |
| **Cursor**           | Coding assistant for implementation and testing  |
| **Gemini**           | Hosted model for the Plan Assistant (when keyed) |


**What was verified**

- Baseline-style KPIs and shortage behaviour on the sample workbook  
- Engine rules: ordering, EXACT/MINIMUM, capacity, local residual, quality upgrade  
- Validation rejections (mix, 5 t multiples, modes, segments, prices, duplicates)  
- Assistant: grounded IDs, reject / provider failure, no-key path  
- Docker clean start and `pytest` suite

Approximate time spent:

- **3 hours** — understanding the problem and brainstorming the theory solution  
- **1 hour** — designing the frontend with Stitch by Google  
- **7 hours** — coding and testing

**Total: about 11 hours** (within the 10–12 hour time box)



With more time, I would connect Atlas Fresh to the company ERP so that an approved daily plan is written back into the corporate database (allocations, residuals, and shortage reasons) instead of staying only in the browser session — with validation, idempotent sync, and an audit trail before anything is marked executed.
