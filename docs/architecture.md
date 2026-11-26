# Architecture

## Components

```text
Local machine                                  Huawei Cloud
+---------------------------------------+      +-----------------------+
| Browser: React UI                     |      | MaaS                  |
| Chat, tables, charts, SQL, analysis   |      | SQL planning          |
| Model selector, saved conversations   |      | Optional analysis     |
+-------------------+-------------------+      | Connection checks     |
                    | /api                    +-----------^-----------+
+-------------------v-------------------+                  |
| Vite development server               |                  |
| Serves UI; proxies /api to FastAPI    |                  | HTTPS
+-------------------+-------------------+                  |
                    |                                     |
+-------------------v-------------------+                  |
| FastAPI backend                       |                  |
| Query service + MaaS client           +------------------+
| Model allowlist + SQL validation      |
| Read-only execution + analysis        |
+-----------+-------------------^-------+
            | query             | rows
+-----------v-------------------+-------+
| SQLite: synthetic scenario data       |
+---------------------------------------+

Backend inputs: .env (endpoint, key, model allowlist, database path)
                Scenario JSON (data scope, metrics, seed configuration)
Browser storage: conversations and language preference
```

Only the backend calls MaaS and accesses SQLite. Vite provides the local development proxy. For an optional hosted demo, [ECS deployment](deployment.md) uses Nginx for static files and API proxying, and systemd for the backend.

## Query flow

1. The UI sends the question, language, recent conversation context and the selected model to `/api/chat`.
2. The backend validates the model against the allowlist; SQL generation and any analysis use that same model.
3. MaaS returns a query plan, a clarification question or a short message.
4. For a query, the backend validates the SQL and executes it through a read-only SQLite connection. Table/function allowlists, execution limits and a 200-row cap apply.
5. If the question requests analysis through common English/Chinese keywords and rows are available, the backend makes an additional MaaS analysis call using the query result.
6. The UI displays the result table, expandable SQL, a chart when the rows suit one, and any analysis or warnings.

`/api/chat` returns `chart: null`. The frontend derives bar and line charts from the returned table rows: a line chart for date/month labels and a bar chart for other category comparisons, with one numeric measure. No additional model call is made, and empty, single-row or unsuitable results stay table-only.

Responses are non-streaming. The browser keeps conversations in local storage and sends up to six previous turns with results as history. Follow-up query plans are validated and executed again. Clarifications and non-query messages do not execute SQL. Analysis intent uses a small keyword rule in the query service. Explicit data-only wording suppresses analysis; unfamiliar phrasing may be missed.

The `/api/health` response exposes the current model, the allowlist and the default model. Requests with an unknown model ID return HTTP 422. On the frontend, switching the model re-runs the connection check and is disabled while a request is in flight; the selection survives New chat but resets to the default on refresh.

## Data and configuration

The backend loads `.env` and scenario JSON at startup; restart it after editing either. `MAAS_MODEL` sets the default, falling back to the first allowlisted model when it is unset; the optional comma-separated `MAAS_MODELS` allowlist feeds the model selector, and the default model is always included. A connection check makes a small MaaS request. Credentials are never sent to the frontend.

Conversations, including questions, returned tables/SQL/analysis and the active conversation id, are stored in `localStorage` under versioned keys (`chatbi-conversations-v1`, `chatbi-active-v1`). The UI caps stored conversations and turns, sanitizes restored data, and shows a warning if storage is unavailable. Clearing site data removes the history; nothing is shared between browsers or machines.

Startup seeds a database only when it has no tables. Existing tables must match the scenario; existing data is preserved. The current implementation supports SQLite and the included retail schema. Scenario JSON supplies seed values and business context, but a different industry schema also requires changes to the seed routine, query prompt and relevant UI text.

This is a local demo without authentication or tenant isolation. A future database adapter needs equivalent read-only permissions, query limits and SQL validation.

## Code map

| File | Responsibility |
|---|---|
| `backend/app/main.py` | Endpoints, request validation, model allowlist enforcement and startup |
| `backend/app/config.py` | Environment, model allowlist and scenario loading |
| `backend/app/maas.py` | Model requests and connection errors |
| `backend/app/service.py` | Query planning and result-based analysis |
| `backend/app/database.py` | Seed data, SQL validation and read-only execution |
| `frontend/src/main.tsx` | Conversation UI, model selector, language and request state |
| `frontend/src/chart.ts` | Derives bar/line chart specs from table rows |
| `frontend/src/ChartView.tsx` | Renders charts with ECharts and handles resize/cleanup |
| `frontend/src/conversations.ts` | Local storage schema, sanitizing, titles and limits |

See the [API contract](api.md) for request/response details, the [data dictionary](data-dictionary.md) for metrics, and [AGENTS.md](../AGENTS.md) for development rules. The [README](../README.md#documentation) lists all documents.
