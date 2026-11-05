# Progress

## Phase 0: Scaffold and tooling (built, acceptance test pending)

Done:

- npm workspaces monorepo: `apps/web`, `apps/api`, `content`, `infra`.
- `docker-compose.yml` with web, api, Judge0 (server, worker, Postgres, Redis), and a SQLite volume.
- `/api/health` endpoint and a page that displays its result.
- `.env.example`, README, and lint, format, typecheck, test, and build scripts.

Verified without Docker:

- Lint, typecheck, unit tests, and builds pass.
- From a clean copy of the repo, the install and build commands in the Dockerfiles succeed, and the
  built API serves a passing health check using a real SQLite file.

Not yet verified, because Docker is not installed on the development machine:

- The Phase 0 acceptance test: fresh clone + `docker compose up` shows the web app and a passing
  health check.
- The Compose file, the images, the nginx config, and Judge0 itself have never been run.

## Next

1. Install Docker Desktop, apply the WSL setting in the README if needed, and run the Phase 0
   acceptance test.
2. Start Phase 1: content model and question bank format.
3. Before Phase 3: confirm Judge0 runs on this machine. If it cannot, use the per-language Docker
   runner fallback from the plan.
