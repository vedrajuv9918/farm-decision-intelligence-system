from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class DecisionRecord(Base):
    __tablename__ = "decision_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    module: Mapped[str] = mapped_column(String(64), index=True)
    location: Mapped[str] = mapped_column(String(255), default="")
    crop: Mapped[str | None] = mapped_column(String(120), nullable=True)
    recommendation: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class MandiHistory(Base):
    __tablename__ = "mandi_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    arrival_date: Mapped[date] = mapped_column(Date, index=True)
    state: Mapped[str] = mapped_column(Text, index=True)
    district: Mapped[str] = mapped_column(Text, index=True)
    market: Mapped[str] = mapped_column(Text, index=True)
    commodity: Mapped[str] = mapped_column(Text, index=True)
    variety: Mapped[str | None] = mapped_column(Text, nullable=True)
    min_price: Mapped[float] = mapped_column(Numeric(12, 2))
    max_price: Mapped[float] = mapped_column(Numeric(12, 2))
    modal_price: Mapped[float] = mapped_column(Numeric(12, 2))
