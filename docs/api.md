# API contract

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Backend and MaaS status, model allowlist, default model and feature flags |
| POST | `/api/connection/check` | Makes a short real model call; never returns the key |
| GET | `/api/scenario` | Public scenario information and suggestions |
| POST | `/api/chat` | Natural-language query or clarification |

## Models

`/api/health` returns the model allowlist in `models` plus `default_model` (and the currently configured `model`). The allowlist comes from the optional `MAAS_MODELS` environment variable (comma-separated); when unset it contains only `MAAS_MODEL`, and when `MAAS_MODEL` is unset the first allowlisted model is the default. Requests may pass any allowlisted model via the optional `model` field; unknown or missing-allowlist IDs are rejected with HTTP 422 and `detail: {code: "invalid_model"}`. When `model` is omitted, the default model is used.

## Chat request

```json
{"question":"What were sales by store in September 2026?","history":[],"language":"en","model":"deepseek-v4.1-flash-1017"}
```

`language` is `en` by default and may be `zh`. `model` is optional and must be one of the allowlisted IDs in `/api/health`; omitted means the default model. SQL generation and analysis always use the same requested model within one chat request. History accepts user and assistant messages, up to 12 items and 3000 characters each. Questions are limited to 2000 characters.

Simple English/Chinese keywords such as analysis, explain, why, 分析 or 建议 request analysis when the query returns rows. Explicit data-only or no-analysis wording suppresses it. This is a lightweight rule, so unfamiliar wording may not be recognized. There is no analysis checkbox or request flag.

## Chat response

| Field | Meaning |
|---|---|
| `kind` | `query`, `message` or `clarify` |
| `answer` | Query scope, a short message or a clarification question |
| `sql` | Validated SQL, or `null` for a non-query response |
| `table` | `columns`, `rows`, `row_count` and `truncated`, or `null` |
| `chart` | Always `null`; the frontend derives bar/line charts client-side from `table` rows |
| `analysis` | Generated analysis text, or `null` |
| `warnings` | Messages about truncation or failed analysis; otherwise `[]` |

`message` and `clarify` responses include `sql`, `table`, `chart` and `analysis` as `null`. Tables contain at most 200 rows; `truncated` indicates additional rows were omitted. An analysis failure preserves the successful query result and adds a warning.

## Charts

Charts are rendered in the frontend from the returned `table` rows, so the backend never invents chart data. When a table has at least two rows, one non-numeric label column and one numeric measure column, the frontend draws a bar chart for category comparisons (sorted by value) or a line chart for date/month labels (sorted chronologically). Empty, single-row or otherwise unsuitable results stay table-only, and the full table and SQL remain visible alongside any chart. `/api/health` reports this as `features.charts: true`.

## Errors

Chat returns HTTP 503 for MaaS failures and HTTP 422 for invalid requests, unknown model IDs, or unsafe/invalid query plans. Service errors use `detail: {code, message}`; request validation errors may use FastAPI's standard validation format. Upstream response bodies and credentials are not exposed.

`/api/connection/check` accepts an optional `{"model": "..."}` body from the same allowlist and returns a status object with `state`, `message` and the checked `model`, including failed connection states, rather than using chat's error format. Unknown model IDs still return HTTP 422 with `detail: {code: "invalid_model"}`. Interactive endpoint schemas are available at `/docs` on the running backend.
