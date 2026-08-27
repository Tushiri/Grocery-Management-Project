#!/usr/bin/env bash
# Confirms pytest and pytest-asyncio are configured and runnable via uv.
set -euo pipefail
cd "$(dirname "$0")/.."
uv run pytest "$@"
