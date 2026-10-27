# ResearchForge — Research Intelligence & Quantitative Portfolio Analytics Platform

<p align="center">
  <a href="https://github.com/Arushi-1011/researchforge/actions/workflows/ci.yml">
    <img src="https://github.com/Arushi-1011/researchforge/actions/workflows/ci.yml/badge.svg" alt="CI Status" />
  </a>
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?style=flat&logo=python&logoColor=white" alt="Python 3.12" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-4169E1?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white" alt="Docker Compose" />
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat" alt="MIT License" />
  </a>
</p>

<p align="center">
  <b>A full-stack research operating system and quantitative portfolio engine. Connects automated academic literature discovery (arXiv & Semantic Scholar), selectable PDF text extraction, comparison matrices, research-gap tracking, deterministic document compilation, role-based access control (RBAC), and financial signal-processing techniques applied to research corpora.</b>
</p>

<p align="center">
  <a href="#-the-problem">The Problem</a> •
  <a href="#-system-architecture">Architecture</a> •
  <a href="#-design-decisions--trade-offs">Design Decisions</a> •
  <a href="#-quantitative-analytics--portfolio-scoring">Quant Engine</a> •
  <a href="#%EF%B8%8F-performance-benchmarks">Benchmarks</a> •
  <a href="#-rest-api-surface">API Reference</a> •
  <a href="#-quickstart--local-setup">Quickstart</a> •
  <a href="#-resume-bullet-points">Resume Bullets</a>
</p>

---

## 💡 The Problem

Literature reviews in engineering and quantitative research degrade quickly:
1. **Fragmented Workspaces**: Publications, PDFs, extraction snippets, and comparative notes are scattered across disconnected browser tabs and local directories.
2. **Invisible Redundancy vs. True Breadth**: Researchers lack an objective, mathematical metric to evaluate whether a bibliography is intellectually diverse or composed of redundant, highly correlated citations.
3. **Fragile Collaboration**: Teams lack scoped multi-user workspaces with clear ownership boundaries, auditing, and deterministic report compilation.

**ResearchForge** solves this by unifying the entire research lifecycle into a single, multi-tenant workspace backed by a **quantitative portfolio scoring engine** that models reading lists like financial portfolios.

---

## ✨ Core Capabilities

| Subsystem | Architectural Capabilities |
|---|---|
| **Automated Ingestion** | Query arXiv Atom feeds and Semantic Scholar Graph APIs with deduplication, backoff retry, and in-memory TTL caching. |
| **PDF Extraction Engine** | Deterministic selectable-text extraction via PyMuPDF with page count and character indexing (guarded by 25 MB upload limits). |
| **Quant Portfolio Scoring** | Models literature corpora as asset portfolios: computes publication momentum ($z$-scores), pairwise cosine similarity matrices, and multi-factor health scores (`STRONG_BUY`, `HOLD`, `REBALANCE`). |
| **Semantic & Vector Search** | 384-dimensional term-hashed embeddings with cosine ranking and PostgreSQL `pgvector` IVFFlat indexing, with deterministic lexical fallbacks. |
| **Structured Document Engine**| Deterministic Jinja2 template rendering compiling project metadata, comparison tables, and gaps into HTML, DOCX, and WeasyPrint PDF reports without LLM hallucinations. |
| **Zero-Trust Multi-Tenancy** | Workspaces enforce discrete RBAC tiers (`OWNER`, `EDITOR`, `VIEWER`), short-lived access JWTs, and SHA-256 hashed rotating refresh tokens. |
| **Defensive Telemetry** | Thread-safe sliding-window rate limiting (HTTP 429), defensive ASGI security headers, and structured ISO-8601 JSON logging with context-propagated `request_id` (`ContextVar`). |

---

## 🏛️ System Architecture

ResearchForge enforces a strict **unidirectional dependency layer** (`routers → services → repositories/models`) with boundary rules verified via `import-linter`. AI and compute-intensive operations are strictly quarantined behind explicit POST actions and never executed on static reads, imports, or background loops.

```mermaid
flowchart TD
    subgraph Client["Presentation Tier (React 18 SPA)"]
        SPA["React 18 · Vite · Strict TypeScript"]
        UI_STORE["TanStack Query · TailwindCSS · Lucide"]
        DEMO_BTN["1-Click Instant Recruiter Demo"]
        SPA --- UI_STORE
        SPA --- DEMO_BTN
    end

    Client -->|"Bearer JWT + X-Request-ID"| GATEWAY

    subgraph Server["FastAPI Application Tier (Async ASGI)"]
        GATEWAY["ASGI Gateway & Security Middleware<br/>CSP · nosniff · frame-deny · X-Request-ID ContextVar"]
        LIMITER["SlidingWindowLimiter<br/>Thread-safe asyncio monotonic limiter (10 req/60s)"]
        
        GATEWAY --> LIMITER
        
        subgraph Modules["Isolated Domain Modules"]
            AUTH["Auth & Users<br/>Argon2id · SHA-256 Refresh Tokens"]
            PROJ["Projects & RBAC<br/>require_owner Dependency Guards"]
            QUANT["Quant Engine<br/>Vectorized Velocity & Cosine Similarity"]
            DISC["Discovery & Library<br/>arXiv · Semantic Scholar · PyMuPDF"]
            DOCS["Document Compiler<br/>Jinja2 · WeasyPrint PDF · DOCX"]
            AI["Vector Search<br/>384-dim Hashed Embeddings · pgvector"]
        end

        LIMITER --> AUTH & PROJ & QUANT & DISC & DOCS & AI
    end

    Modules -->|"asyncpg Connection Pool"| STORAGE

    subgraph Storage["Persistence & Storage Tier"]
        DB[("PostgreSQL 16 Enterprise<br/>SQLAlchemy 2.0 Async ORM")]
        VECTOR["pgvector Extension<br/>IVFFlat Cosine Distance Index"]
        MIGRATIONS["Alembic Migrations<br/>Revisions 0001 through 0008_rbac_vector"]
        FILES["Local Encrypted Storage<br/>25MB Validated PDF Binaries"]
        
        DB --- VECTOR
        DB --- MIGRATIONS
        DISC --> FILES
    end
```

---

## ⚖️ Design Decisions & Trade-Offs

A key marker of senior engineering is making deliberate, documented architectural trade-offs:

| Engineering Decision | Why Chosen | Conscious Trade-Off / Alternative Considered |
|---|---|---|
| **Refresh Tokens: 256-bit Random + SHA-256 DB Hash** | Because tokens possess 256-bit cryptographically random entropy (`secrets.token_urlsafe(32)`), SHA-256 hashing is secure and computationally fast per request. A database snapshot leak never exposes usable plaintext tokens. | Fast hashing is unsuitable for low-entropy user passwords; **passwords strictly use Argon2id** via `pwdlib`. |
| **Token Rotation with Instant Invalidation** | New refresh tokens are issued on every `/auth/refresh` invocation; old tokens are immediately invalidated. `/auth/logout` sets explicit UTC revocation. | Requires one additional database write per refresh exchange, acceptable for a robust security posture. |
| **RBAC Enforced via Dependency Injection (`require_owner`)** | Declarative FastAPI dependency injection ensures authorization logic is verified atomically before handler execution. Destructive endpoints (`PATCH`, `DELETE`) cannot be accidentally added without compile/lint visibility. | Incurs a membership verification query on mutations; optimized with compound indexing on `(project_id, user_id)`. |
| **In-Process Sliding-Window Limiter (`app/core/ratelimit.py`)** | Zero external infrastructure requirement, microsecond lock latency, and trivial to mock in automated testing environments. Returns RFC-compliant `429 Too Many Requests` + `Retry-After`. | State is bound to the single Python process. In a distributed multi-replica cluster, this shifts to a distributed Redis sliding-log counter. |
| **384-Dimensional Term-Hashed Embeddings** | Completely deterministic, zero network latency, zero gigabyte model downloads, and fully testable in air-gapped CI environments with mathematical cosine ranking. | Measures lexical and term-overlap semantics rather than deep contextual nuances; designed to fall back gracefully to pgvector or pure lexical search. |
| **Deterministic Jinja2 Document Generation** | Scientific dossiers and comparison reports must be accurate, reproducible, and verifiable. Reports compile through Jinja2 into WeasyPrint PDF and DOCX. | Does not generate conversational LLM text on export; eliminates hallucination risk for academic citations. |

---

## 📈 Quantitative Analytics & Portfolio Scoring

ResearchForge adapts financial portfolio theory and signal processing to academic reading lists:

### 1. Publication Momentum & Velocity
- Calculates centered rolling-window moving averages (`rolling_velocity`) across publication periods.
- Derives publication acceleration $z$-scores ($\sigma$ standard deviation relative to historical baseline) to detect accelerating trends versus dormant research areas:
  $$\text{Velocity Signal } (z) = \frac{\text{Count}_{\text{latest}} - \overline{\text{Count}}_{\text{rolling}}}{\sigma_{\text{counts}}}$$

### 2. Pairwise Cosine Similarity Matrix
- Computes pairwise cosine similarity across all papers in the workspace using L2-normalized TF-IDF term vectors ($\text{unit} \cdot \text{unit}^T$).
- Identifies cluster redundancy (high correlation $\to$ duplicative papers) versus orthogonal novelty (low correlation $\to$ research diversity).

### 3. Multi-Factor Portfolio Health Scoring
A deterministic composite score ($0$ to $100$) evaluated across four quantitative factors:
$$\text{Composite Score} = 0.25 \cdot C + 0.35 \cdot D + 0.25 \cdot R + 0.15 \cdot V$$

| Factor | Weight | Formulation | Purpose |
|---|---|---|---|
| **Coverage ($C$)** | $25\%$ | $\frac{\text{Papers with full text extracted}}{\text{Total Papers}}$ | Data completeness |
| **Diversity ($D$)** | $35\%$ | $1.0 - \text{Average off-diagonal pairwise cosine similarity}$ | Portfolio breadth (non-redundancy) |
| **Recency Decay ($R$)** | $25\%$ | $e^{-\frac{\ln(2) \cdot \Delta t}{5.0}}$ (Exponential decay with 5-year half-life) | Temporal currency of findings |
| **Velocity Signal ($V$)** | $15\%$ | Normalized $z$-score clipped to $[0, 1]$ | Recent publication momentum |

**Algorithmic Guidance**:
- **`STRONG_BUY`** ($\ge 70$): Comprehensive, diverse literature collection with active publication momentum.
- **`HOLD`** ($50 - 69$): Moderate diversity; text coverage gaps or aging citations present.
- **`REBALANCE`** ($< 50$): Excessive redundancy or stale citations; needs topic broadening.

---

## ⏱️ Performance Benchmarks

ResearchForge includes a high-precision performance benchmarking harness at [`backend/benchmarks/benchmark_quant.py`](file:///Users/arushi/Downloads/researchforge-integrated%202/backend/benchmarks/benchmark_quant.py).

Run the benchmark suite locally:
```bash
python backend/benchmarks/benchmark_quant.py
```

### Verified Test Results
- **Hardware**: Apple Silicon (M-series / ARM64, 10-core CPU)
- **Runtime**: Python 3.12, NumPy 2.2+
- **Methodology**: 5 iterations per corpus size, high-resolution `time.perf_counter()`

| Corpus Size | Pairwise Dot-Products | Matrix Latency (Mean) | Momentum Latency | Portfolio Composite |
|---|---|---|---|---|
| **10 papers** | 45 pairs | **0.28 ms** | 0.01 ms | 68.5 / 100 |
| **50 papers** | 1,225 pairs | **1.21 ms** | 0.03 ms | 68.5 / 100 |
| **100 papers** | 4,950 pairs | **2.59 ms** | 0.08 ms | 68.5 / 100 |
| **250 papers** | 31,125 pairs | **7.83 ms** | 0.33 ms | 68.5 / 100 |

*Zero external network I/O; deterministic and pure matrix operations.*

---

## 📡 REST API Surface

All routes are versioned under `/api/v1` and document OpenAPI 3.1 / Swagger schemas.

### Authentication & Sessions
| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | Register user account with Argon2id password hashing |
| `POST` | `/api/v1/auth/login` | Public | Authenticate credentials; returns access JWT + rotating refresh token |
| `POST` | `/api/v1/auth/login/oauth`| Public | RFC-compliant OAuth2 form login for standard tooling |
| `POST` | `/api/v1/auth/refresh` | Public | Exchange valid refresh token for a new access token |
| `POST` | `/api/v1/auth/logout` | Bearer JWT | Revoke active refresh token in database |
| `GET` | `/api/v1/auth/me` | Bearer JWT | Retrieve current authenticated user profile |

### Workspaces & RBAC
| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `GET` | `/api/v1/projects` | Bearer JWT | List workspaces where user has membership |
| `POST` | `/api/v1/projects` | Bearer JWT | Create workspace; creator assigned `OWNER` role |
| `GET` | `/api/v1/projects/{id}` | Member | Retrieve workspace details |
| `PATCH` | `/api/v1/projects/{id}` | Owner | Update workspace name/description (`require_owner`) |
| `DELETE` | `/api/v1/projects/{id}` | Owner | Delete workspace and cascade-delete child records |
| `GET` | `/api/v1/projects/{id}/members` | Member | List project members with assigned roles |
| `POST` | `/api/v1/projects/{id}/members` | Member | Invite registered user as `EDITOR` |
| `DELETE` | `/api/v1/projects/{id}/members/{uid}` | Member | Evict member (owners can remove others; self-removal permitted) |

### Discovery, Ingestion, & Quant Analytics
| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/v1/discovery/search` | Bearer JWT | Query arXiv & Semantic Scholar with rate limiting & deduplication |
| `GET` | `/api/v1/projects/{id}/library` | Member | Retrieve workspace literature library |
| `POST` | `/api/v1/projects/{id}/library/import` | Member | Import paper from search results with metadata deduplication |
| `POST` | `/api/v1/projects/{id}/library/upload` | Member | Upload PDF binary (25 MB limit) with safe file naming |
| `POST` | `/api/v1/projects/{id}/library/{pid}/extract`| Member | Extract selectable text via PyMuPDF |
| `GET` | `/api/v1/projects/{id}/analytics` | Member | Complete quant report: timeline, similarity matrix, health score |
| `GET` | `/api/v1/projects/{id}/analytics/timeline` | Member | Annual publication time-series with rolling momentum |
| `GET` | `/api/v1/projects/{id}/analytics/similarity`| Member | Pairwise cosine similarity matrix with outlier insights |
| `GET` | `/api/v1/projects/{id}/analytics/portfolio` | Member | Multi-factor portfolio health score and signals |

### Comparisons, Gaps, & Documents
| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `GET/POST`| `/api/v1/projects/{id}/comparisons` | Member | Create and list multi-paper comparison matrices |
| `GET/POST`| `/api/v1/projects/{id}/gaps` | Member | Track identified research gaps (`OPEN` / `ADDRESSED`) |
| `GET/POST`| `/api/v1/projects/{id}/documents` | Member | Compile structured research dossiers (Jinja2) |
| `GET` | `/api/v1/projects/{id}/documents/{did}/view` | Member | Render authenticated HTML document view |
| `GET` | `/api/v1/projects/{id}/documents/{did}/export.{ext}` | Member | Download compiled document as PDF or DOCX |

---

## 🗄️ Relational Data Model

Managed through **Alembic** migrations ([`backend/alembic/versions`](file:///Users/arushi/Downloads/researchforge-integrated%202/backend/alembic/versions)):

| Entity | Primary Key | Foreign Keys & Cascades | Key Columns & Indices |
|---|---|---|---|
| `users` | `id` (UUID) | 1-to-many `projects`, `refresh_tokens` | `email` (unique index), `password_hash`, `display_name` |
| `refresh_tokens` | `id` (UUID) | `user_id` $\to$ `users.id` (CASCADE) | `token_hash` (unique index), `expires_at`, `revoked_at` |
| `projects` | `id` (UUID) | `created_by` $\to$ `users.id` (CASCADE) | `name`, `description`, `created_at`, `updated_at` |
| `project_members` | `(project_id, user_id)` | FKs $\to$ `projects.id`, `users.id` | `role` (`OWNER`, `EDITOR`, `VIEWER`), `created_at` |
| `library_papers` | `id` (UUID) | `project_id` $\to$ `projects.id` (CASCADE) | `source`, `source_id`, `title`, `extracted_text`, `embedding` (vector) |
| `comparisons` | `id` (UUID) | `project_id` $\to$ `projects.id` (CASCADE) | `title`, `created_by`, `created_at` |
| `comparison_papers` | `(comparison_id, paper_id)`| FKs $\to$ `comparisons.id`, `library_papers.id` | `position` (integer ordering) |
| `research_gaps` | `id` (UUID) | FKs $\to$ `projects.id`, `comparisons.id` | `note`, `status` (`OPEN`/`ADDRESSED`), `origin` (`USER`/`AI`) |
| `ai_results` | `id` (UUID) | FKs $\to$ `projects.id`, `users.id` | `feature`, `provider`, `result_json`, `evidence_json` |
| `subscriptions` | `id` (UUID) | `user_id` $\to$ `users.id` (CASCADE) | `plan` (`FREE`/`PREMIUM`), `status` (`ACTIVE`) |
| `project_documents` | `id` (UUID) | `project_id` $\to$ `projects.id` (CASCADE) | `title`, `sections_json`, `include_ai`, `created_at` |

---

## 🚀 Quickstart & Local Setup

### Option A: Docker Compose (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/Arushi-1011/researchforge.git
cd researchforge

# 2. Configure environment
cp .env.example .env

# 3. Start all container services
docker compose up --build -d

# 4. Apply database schema migrations
docker compose exec api alembic upgrade head

# 5. Open in browser
open http://localhost:5174
```

| Service | Address | Description |
|---|---|---|
| **Web Client** | `http://localhost:5174` (or `5173`) | React 18 SPA |
| **API Gateway** | `http://localhost:8001` | FastAPI ASGI backend (`/docs` for Swagger UI) |
| **Database** | `localhost:5433` | PostgreSQL 16 with pgvector |

> **⚡ 1-Click Guest Recruiter Demo**: On the login screen, click **`Instant Guest Recruiter Demo (1-Click)`** to instantly sign into an active test environment without filling out registration forms.

### Option B: Local Host Development

```bash
# 1. Start PostgreSQL via Docker
docker compose up -d db

# 2. Backend Setup
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 3. Frontend Setup (in separate terminal)
cd ../frontend
npm ci
npm run dev
```

---

## 🧪 Testing Discipline

ResearchForge guarantees reproducible testing with zero live external network calls during automated CI:

```bash
# Run backend pure unit tests & benchmarks
cd backend
python benchmarks/benchmark_quant.py
python -m unittest tests/test_embeddings.py tests/test_quant_analytics.py

# Run frontend tests & production build verification
cd ../frontend
npm test -- --run
npm run build
```

- **Unit & Math Testing**: Pure mathematical verification of TF-IDF tokenization, cosine similarity, and portfolio factors without database or I/O overhead.
- **Frontend Quality**: 8 of 8 Vitest + React Testing Library component tests passing.
- **TypeScript Static Typing**: `tsc --noEmit` runs with 0 errors across all routes and API client schemas.
- **End-to-End Suite**: Playwright workflow integration in [`e2e/workflow.spec.ts`](file:///Users/arushi/Downloads/researchforge-integrated%202/e2e/workflow.spec.ts).

---

## 📄 Resume Bullet Points (Copy & Paste Ready)

### For Full-Stack / Backend Engineering Roles (Stripe, Meta, Datadog):
> - **Architected an enterprise research intelligence platform** in FastAPI and React 18 / TypeScript, designing a layered architecture (`routers → services → repositories`) with strict `import-linter` boundary validation.
> - **Engineered zero-trust RBAC and session security**, implementing short-lived JWTs alongside SHA-256 hashed refresh tokens with instant revocation and thread-safe sliding-window rate limiting.
> - **Implemented structured distributed tracing** via Starlette ASGI middleware with ISO-8601 UTC logging and context-propagated `request_id` (`ContextVar`), achieving sub-1.5s production bundle builds and 100% type coverage.

### For Quant Systems / Trading Platform Roles (Citadel, Two Sigma, D.E. Shaw):
> - **Engineered a high-performance quantitative literature portfolio engine**, applying financial time-series techniques to academic corpora, including centered rolling-window velocity momentum ($z$-scores) and factor-weighted health scoring.
> - **Vectorized pairwise cosine similarity matrices** using L2-normalized TF-IDF term embeddings, calculating over **31,000 pairwise dot products in $<8\text{ms}$** to detect research redundancy versus portfolio diversification.
> - **Designed deterministic compilation pipelines** generating structured research reports (HTML, DOCX, WeasyPrint PDF) and semantic ranking with fallback from pgvector to term-hashed vectors.

---

## 📜 License

Distributed under the [MIT License](LICENSE).
