#!/usr/bin/env bash
# Start the Scheme Saathi API on http://localhost:8000 (docs at /docs)
cd "$(dirname "$0")"
exec python3 -m uvicorn app.main:app --reload --port "${PORT:-8000}"
