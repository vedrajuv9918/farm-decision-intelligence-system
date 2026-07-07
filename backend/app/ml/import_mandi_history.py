from __future__ import annotations

import asyncio

from app.db import init_db
from app.services.history_service import HistoryService


async def main() -> None:
    await init_db()
    await HistoryService().ensure_imported()
    print("mandi_history import completed")


if __name__ == "__main__":
    asyncio.run(main())
