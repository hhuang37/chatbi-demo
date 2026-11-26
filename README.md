# Lion City ChatBI

A hands-on ChatBI demo for Huawei Cloud CodeArts Agent. Ask questions in English or Chinese; Huawei Cloud MaaS generates SQL, the backend checks and runs a read-only query, and the app displays the results.

The included scenario is a fictional Singapore retailer with four stores and eight products. All data is synthetic, covers January–September 2026 and uses SGD.

## Current version

The `release/full-v1` branch is the complete demo: query chat, result tables, expandable SQL, bar and line charts for suitable results, analysis when you ask for it, a model selector backed by a server-side allowlist, saved conversations with rename and switch actions, connection checks and English/Chinese switching. Conversations survive a refresh because they are stored in the browser. English is the default language.

The `main` branch remains the starter without charts, model selection or saved conversations. Steps 1–3 in [guide.md](guide.md) describe the exercises this branch implements.

## Get started

Download the Windows kit for your system type from [the full-v1 release](https://github.com/hhuang37/chatbi-demo/releases/tag/full-v1), extract it, then follow [Step 0 in the guide](guide.md#step-0-prepare-the-environment-configure-maas-then-start-manually) to prepare the environment, configure your MaaS token, and start both services in PowerShell.

Working from Git instead of the kit:

```powershell
git clone --branch release/full-v1 https://github.com/hhuang37/chatbi-demo.git
cd chatbi-demo
powershell -NoProfile -ExecutionPolicy Bypass -File .\bootstrap.ps1
```

The bootstrap downloads the `deps-v1` dependency bundle once and then installs offline.

The default app address is [http://127.0.0.1:5173/](http://127.0.0.1:5173/). Use Vite's printed address if you change the port. Once connected, select a suggested question on the page or type your own.

## Documentation

| Document | When to read it |
|---|---|
| [guide.md](guide.md) | Set up, run the demo and review the exercise steps |
| [docs/architecture.md](docs/architecture.md) | Understand the components and query flow |
| [docs/api.md](docs/api.md) | Change or call the backend API |
| [docs/data-dictionary.md](docs/data-dictionary.md) | Understand the sample data and metrics |
| [docs/deployment.md](docs/deployment.md) | Optional Linux ECS deployment for a later hosted demo |
| [AGENTS.md](AGENTS.md) | Development instructions and checks for coding agents |

## Project structure

```text
backend/app/        FastAPI API, MaaS client and SQL safety
backend/scenarios/  Scenario description and seed configuration
backend/data/       Synthetic SQLite database
backend/tests/      Backend and SQL safety tests
frontend/src/       React + TypeScript conversation UI, charts and saved conversations
docs/               Architecture, API and data dictionary
offline/build/      Offline kit packaging and acceptance scripts
setup.ps1           Windows environment setup
setup.sh            Linux / macOS environment setup
```

The app uses Vite, Tailwind CSS, ECharts and SQLAlchemy alongside the components above. It is a local demo with SQLite, without login or tenant isolation. MaaS credentials stay in the backend; real model requests consume your account quota. Conversations are stored in the browser's local storage, so they stay on one browser profile and are never uploaded.
