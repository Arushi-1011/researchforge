# ResearchForge architecture

## Component diagram
```mermaid
flowchart TB
  Browser[React SPA] -->|HTTPS /api| API[FastAPI modular monolith]
  API --> DB[(PostgreSQL 16 + pgvector)]
  API --> Sources[SourceAdapter registry]
  Sources --> Arxiv[arXiv]
  Sources --> S2[Semantic Scholar]
  API --> Storage[StorageService]
  API --> Jobs[JobRunner]
  API --> AI[Premium AI module]
  AI --> LLM[LLMProvider: Fake / OpenAI / Anthropic]
  AI --> Vector[(pgvector chunks)]
  API --> Docs[Document builder]
  Docs --> PDF[WeasyPrint]
  Docs --> DOCX[python-docx]
```

## Package diagram
```mermaid
flowchart LR
  core --> users
  core --> projects
  projects --> discovery
  discovery --> sources
  discovery --> library
  library --> extraction
  projects --> analysis
  projects --> documents
  ai --> library
  ai --> projects
  ai --> sources
```

## Deployment diagram
```mermaid
flowchart TB
  User[Desktop / mobile browser] --> Web[React + Vite / Caddy]
  Web --> API[FastAPI container]
  API --> DB[(PostgreSQL + pgvector volume)]
  API --> Files[(Local storage volume)]
  API --> External[arXiv / Semantic Scholar / LLM provider]
```

## ER diagram
```mermaid
erDiagram
  USER ||--o{ PROJECT_MEMBER : joins
  PROJECT ||--o{ PROJECT_MEMBER : has
  PROJECT ||--o{ PUBLICATION : stores
  PUBLICATION ||--|| EXTRACTED_INFO : extracts
  PUBLICATION ||--o{ PDF_FILE : contains
  PUBLICATION }o--o{ TAG : categorized
  PROJECT ||--o{ COMPARISON : defines
  COMPARISON }o--o{ PUBLICATION : compares
  PROJECT ||--o{ RESEARCH_GAP : tracks
  PROJECT ||--o{ AI_RESULT : records
  PROJECT ||--o{ PROJECT_DOCUMENT : generates
  USER ||--|| SUBSCRIPTION : owns
```

## Module boundaries

Routers handle HTTP validation and dependencies; services contain business rules; repositories/models own persistence. Only source adapters communicate with publication APIs, only `ai/llm` calls LLM vendors, and only `storage` handles file-system operations. AI is a dependency leaf and must not be imported by extraction, discovery, library, analysis, documents, or projects.
