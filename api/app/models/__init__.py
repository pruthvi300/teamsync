# Import every model so Base.metadata knows all tables.
from app.models.board import Board, board_members
from app.models.column import Column
from app.models.comment import Comment
from app.models.task import Task
from app.models.user import User

__all__ = ["User", "Board", "board_members", "Column", "Task", "Comment"]
