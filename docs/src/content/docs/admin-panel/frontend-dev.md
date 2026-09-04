---
title: Frontend Development
description: How to develop, build, and deploy the React admin panel frontend.
sidebar:
  order: 6
---

The React frontend lives in `admin-api/frontend/`. It uses **Vite**, **React**, and **TypeScript**.

---

## Dev workflow

In development, the frontend runs as a Vite dev server in the `frontend` container (`frontend:5173`) with hot module replacement (HMR). Changes to `admin-api/frontend/src/` hot-reload instantly without restarting Docker.

```bash
# Start the full dev stack (includes the frontend container)
npm run docker:dev

# Or run Vite directly on your host machine (faster cold start)
cd admin-api/frontend
npm install
npm run dev    # starts on :5173
```

When running Vite on the host, ensure the Docker stack is running for the backend APIs. The frontend proxies `/api/admin/` to the admin-api container.

---

## Useful commands

```bash
cd admin-api/frontend

npm run dev       # dev server with HMR
npm run build     # production build → admin-api/static/
npm run lint      # ESLint check
npx tsc --noEmit  # type check without building
```

---

## Production build

In production, `npm run build` outputs static files to `admin-api/static/`. The `admin-api` FastAPI container serves these files directly with `StaticFiles`.

After a frontend build:

```bash
# Rebuild the admin-api image with the new static files
docker compose --env-file .env -f docker/docker-compose.prod.yml up --build -d admin-api
```

Or trigger the GitHub Actions workflow manually with `services=admin-api` (or the Bitbucket `deploy-services` custom pipeline if you use that CI instead).

---

## Directory structure

```
admin-api/frontend/src/
├── pages/          # One file per route (DashboardPage.tsx, LogsPage.tsx, ...)
├── components/     # Shared UI components
├── api/            # API client functions (fetch wrappers for /api/admin/*)
├── hooks/          # Custom React hooks
├── store/          # Global state (Zustand or similar)
├── lib/            # Utilities
├── types.ts        # Shared TypeScript types
└── App.tsx         # Router and layout
```

---

## Adding a new page

1. Create `src/pages/YourPage.tsx`.
2. Add a route in `src/App.tsx`.
3. Add a navigation link in the sidebar component.
4. Add API client functions in `src/api/` to call the relevant `/api/admin/` endpoints.

---

## API calls

All API calls go through wrapper functions in `src/api/`. These functions:
- Automatically attach the `Authorization: Bearer <token>` header from local storage.
- Handle 401 responses by redirecting to the login page.
- Return typed responses matching `src/types.ts`.

Never call `fetch` directly in page/component files — always use an API wrapper.
