# SchemeSaathi frontend

React 18 + Tailwind 3 + Vite, built to `SchemeSaathi-Design-System.md` and wired to the FastAPI backend.

    cd ../backend && ./run.sh      # API on :8000
    cd frontend && npm install && npm run dev

`/api` is proxied to `localhost:8000` in dev. For a deployed build set `VITE_API_BASE`.
Microphone access needs HTTPS or localhost; elsewhere the app falls back to tap-and-type.
