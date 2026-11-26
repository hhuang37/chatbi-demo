# Project conventions

This branch, `release/full-v1`, contains the completed demo: charts, model selection and saved conversations. The `main` branch is the starter and keeps the same three features as practice tasks. Read README.md, guide.md and docs/architecture.md before making changes. Keep user-facing documentation in English and distinguish implemented features from practice tasks.

- Keep query, table, collapsible SQL, charts, model selection, saved conversations and MaaS connection status working.
- `/api/chat` keeps returning `chart: null`; bar and line charts are derived in the frontend from the returned table rows. Analysis uses simple question keywords.
- Never read or print `.env` secrets. Never put keys in source, logs, frontend bundles or snapshots.
- Extend the stable `/api/chat` contract. A request may carry an optional `model`, which must be validated against the backend allowlist (`MAAS_MODELS`, falling back to `MAAS_MODEL`); SQL generation and analysis use the same model. Scenario files provide business content; do not hard-code stores, currency or dates in chart components.
- Treat user input and model output as untrusted. Keep SQL AST validation, the SQLite authorizer, read-only connections, row limits and execution timeouts.
- Charts must use the current SQL result, never model-invented values or executable JavaScript/HTML.
- Conversations live in browser local storage; never store credentials there, and keep stored data limited to questions and returned results.
- Seed only an empty database and never overwrite existing scenario data. New scenarios use separate database files.
- Keep the frontend and backend separate and use the existing stack. Prefer small, direct changes; avoid new frameworks, generic adapters and speculative edge-case handling.
- After code changes, run backend pytest and `npm run build`; report validation and remaining limitations. For documentation-only edits, check accuracy, links and `git diff --check`.
- Treat any `sources/` directory above this project as read-only.

## Development checks

From `backend`, run `.venv\Scripts\python.exe -m pytest -q` on Windows or `.venv/bin/python -m pytest -q` on Linux/macOS. From `frontend`, run `npm run build`.

Tests use temporary SQLite databases and simulated MaaS responses. `backend/verify_data.py` is an optional offline integrity check for the bundled retail database. Real MaaS queries use the configured account and consume quota.
