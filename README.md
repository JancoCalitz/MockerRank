# MockerRank

A private, self-hosted practice environment for timed software engineering assessments: a
20-question exam (18 multiple choice, 1 short coding, 1 long coding) with an in-browser editor,
hidden tests, a capped AI assistant, and a scored report.

See [HACKERRANK_REPLICA_PLAN.md](HACKERRANK_REPLICA_PLAN.md) for the full plan and
[PROGRESS.md](PROGRESS.md) for current status.

## Run it

Requires [Docker](https://docs.docker.com/get-docker/) with Compose.

```sh
docker compose up
```

Open <http://localhost:8080>. The page shows the system health: the API and database should say
`ok`. Judge0 takes longer to start, so reload after a minute if it says `unavailable`.

To use a different port, copy `.env.example` to `.env` and change `WEB_PORT`.

### Windows and Judge0

Judge0 needs cgroup v1 and only officially supports Linux, while Docker Desktop on WSL 2 defaults to
cgroup v2. If code execution fails, add this to `%UserProfile%\.wslconfig`, then run `wsl --shutdown`
and restart Docker Desktop:

```ini
[wsl2]
kernelCommandLine = systemd.unified_cgroup_hierarchy=0
```

On a Linux host using cgroup v2, such as Ubuntu 22.04, add the same flag to `GRUB_CMDLINE_LINUX`
instead. Judge0 also collects telemetry by default; see its
[telemetry notes](https://github.com/judge0/judge0/blob/v1.13.1/TELEMETRY.md).

## Develop without Docker

Requires Node.js 24 or later.

```sh
npm install
npm run dev
```

The web app runs at <http://localhost:5173> and proxies `/api` to the API on port 3000. Judge0 shows
as `unavailable` unless you run it separately.

| Command                | Purpose                   |
| ---------------------- | ------------------------- |
| `npm run dev`          | Start the API and web app |
| `npm test`             | Run all unit tests        |
| `npm run lint`         | Lint with ESLint          |
| `npm run typecheck`    | Type-check all workspaces |
| `npm run format`       | Format with Prettier      |
| `npm run format:check` | Check formatting          |
| `npm run build`        | Build all workspaces      |

## Layout

| Path       | Contents                                       |
| ---------- | ---------------------------------------------- |
| `apps/web` | React, TypeScript, Vite, and Tailwind frontend |
| `apps/api` | Fastify and TypeScript backend, with SQLite    |
| `content`  | Question bank and exam definitions             |
| `infra`    | Dockerfiles, nginx config, and Judge0 config   |
