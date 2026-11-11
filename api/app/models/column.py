from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.user import new_id, utcnow


class Column(Base):
    __tablename__ = "columns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(100))
    position: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(7), default="#6366f1")
    wip_limit: Mapped[int] = mapped_column(Integer, default=0)  # 0 = no limit
    board_id: Mapped[str] = mapped_column(String(36), ForeignKey("boards.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    board = relationship("Board", back_populates="columns", lazy="raise")
    tasks = relationship("Task", back_populates="column", lazy="raise", order_by="Task.position")
