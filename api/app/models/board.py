from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Table, Text
from sqlalchemy import Column as SAColumn
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.user import new_id, utcnow

board_members = Table(
    "board_members",
    Base.metadata,
    SAColumn("user_id", String(36), ForeignKey("users.id"), primary_key=True),
    SAColumn("board_id", String(36), ForeignKey("boards.id"), primary_key=True),
    SAColumn("role", String(20), default="member"),
)


class Board(Base):
    __tablename__ = "boards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True, default="")
    background_color: Mapped[str] = mapped_column(String(7), default="#6366f1")
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # lazy="raise": every load is explicit (selectinload in the query), so a
    # forgotten load fails loudly instead of firing hidden queries.
    owner = relationship("User", foreign_keys=[owner_id], lazy="raise")
    members = relationship("User", secondary=board_members, lazy="raise", order_by="User.username")
    columns = relationship("Column", back_populates="board", lazy="raise", order_by="Column.position")
