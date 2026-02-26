# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Caption Muse is an AI-powered Instagram caption generator with a **Node.js/Express backend** (port 3001) and a **React (CRA) frontend** (port 3000), using **MongoDB** as its database.

### Services

| Service | Command | Port | Directory |
|---------|---------|------|-----------|
| MongoDB | `sudo mongod --fork --logpath /var/log/mongod.log --dbpath /data/db` | 27017 | N/A |
| Backend | `npm run dev` | 3001 | `backend/` |
| Frontend | `BROWSER=none yarn start` | 3000 | `frontend/` |

Start MongoDB first, then the backend, then the frontend. The backend connects to MongoDB on startup; if MongoDB is not running, the backend will still start but database operations will fail.

### Environment files

- `backend/.env` — requires at minimum `MONGODB_URI`, `JWT_SECRET`, and `OPENAI_API_KEY` (can be a placeholder for non-AI dev work). See `README.md` for full list.
- `frontend/.env` — requires `REACT_APP_BACKEND_URL=http://localhost:3001`.

These files are gitignored and must be created locally.

### Dependencies

- **Root**: `npm install` (OpenTelemetry, axios, dotenv, TypeScript dev deps)
- **Backend**: `npm install` in `backend/` (Express, MongoDB driver, OpenAI, etc.)
- **Frontend**: `yarn install` in `frontend/` (React 19, Tailwind, etc.) — uses `yarn.lock`, not npm

### Lint / Test / Build

- **Frontend lint**: `npx eslint src/` (from `frontend/`). Currently 0 errors, 3 warnings.
- **Frontend build**: `yarn build` (from `frontend/`).
- **Frontend tests**: `CI=true yarn test` (from `frontend/`). Note: the default CRA test (`App.test.js`) fails because `@testing-library/jest-dom` and `@testing-library/react` are not listed in `package.json` — this is a pre-existing repo issue.
- **Backend tests**: `npm test` (from `backend/`) — currently skipped (no test suite configured).

### Gotchas

- The frontend uses **yarn** (has `yarn.lock`), while root and backend use **npm** (`package-lock.json`). Do not mix package managers.
- Spotify integration errors on startup are expected when `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` are not set — the app works fine without Spotify.
- Cloudinary is optional; without it, images are stored locally in `backend/uploads/`.
- The backend health check endpoint is `GET /health` (not under `/api`).
- `BROWSER=none` should be passed when starting the frontend to prevent it from trying to open a browser.
