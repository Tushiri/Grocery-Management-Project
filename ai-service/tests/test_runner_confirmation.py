"""Confirms the pytest + pytest-asyncio test runner is wired correctly."""

from __future__ import annotations

import pytest


def test_pytest_runner_is_operational() -> None:
    assert True


@pytest.mark.asyncio
async def test_pytest_asyncio_is_operational() -> None:
    async def noop() -> str:
        return "ok"

    assert await noop() == "ok"
