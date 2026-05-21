from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user_model import utc_now

if TYPE_CHECKING:
    from app.models.user_model import User


class LogEntry(Base):
    __tablename__ = "log_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    role_name: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    action: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    details: Mapped[str] = mapped_column(Text, default="", nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        index=True,
        nullable=False,
    )

    user: Mapped["User | None"] = relationship(back_populates="logs")


class ObservationListEntry(Base):
    __tablename__ = "observation_list_entries"
    __table_args__ = (UniqueConstraint("user_id", name="uq_observation_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    role_name: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_action_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="observation_entries")
