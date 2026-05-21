from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user_model import User


class NexusNode(Base):
    __tablename__ = "nexus_nodes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    book_title: Mapped[str] = mapped_column(String(200), nullable=False)
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)

    user: Mapped["User"] = relationship(back_populates="nexus_nodes")
    outgoing_edges: Mapped[list["NexusEdge"]] = relationship(
        foreign_keys="NexusEdge.source_id",
        back_populates="source",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    incoming_edges: Mapped[list["NexusEdge"]] = relationship(
        foreign_keys="NexusEdge.target_id",
        back_populates="target",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class NexusEdge(Base):
    __tablename__ = "nexus_edges"
    __table_args__ = (
        UniqueConstraint("user_id", "source_id", "target_id", name="uq_nexus_edge_pair"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    source_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nexus_nodes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    target_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nexus_nodes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    label: Mapped[str | None] = mapped_column(String(120), nullable=True)

    user: Mapped["User"] = relationship(back_populates="nexus_edges")
    source: Mapped[NexusNode] = relationship(
        foreign_keys=[source_id],
        back_populates="outgoing_edges",
    )
    target: Mapped[NexusNode] = relationship(
        foreign_keys=[target_id],
        back_populates="incoming_edges",
    )
