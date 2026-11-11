"""
Authorization and loading helpers shared by the routers.

Every board-scoped endpoint goes through one of the `*_for_member` helpers,
so the membership check can't be forgotten on a new route.
"""

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.board import Board, board_members
from app.models.column import Column
from app.models.comment import Comment
from app.models.task import Task
from app.models.user import User
from app.schemas.board import TaskResponse


async def is_member(db: AsyncSession, board_id: str, user_id: str) -> bool:
    row = await db.execute(
        select(board_members.c.user_id).where(board_members.c.board_id == board_id, board_members.c.user_id == user_id)
    )
    return row.first() is not None


async def board_for_member(db: AsyncSession, board_id: str, user: User) -> Board:
    board = await db.get(Board, board_id)
    if board is None:
        raise HTTPException(404, "Board not found")
    if not await is_member(db, board_id, user.id):
        raise HTTPException(403, "Not a member of this board")
    return board


async def column_for_member(db: AsyncSession, column_id: str, user: User, *, lock: bool = False) -> Column:
    query = select(Column).where(Column.id == column_id)
    if lock:
        # Serialises concurrent moves/creates in the same column (PostgreSQL; ignored by SQLite).
        query = query.with_for_update()
    column = await db.scalar(query)
    if column is None:
        raise HTTPException(404, "Column not found")
    if not await is_member(db, column.board_id, user.id):
        raise HTTPException(403, "Not a member of this board")
    return column


async def task_for_member(db: AsyncSession, task_id: str, user: User) -> tuple[Task, str]:
    """Return the task and its board id."""
    row = (
        await db.execute(
            select(Task, Column.board_id).join(Column, Task.column_id == Column.id).where(Task.id == task_id)
        )
    ).first()
    if row is None:
        raise HTTPException(404, "Task not found")
    task, board_id = row
    if not await is_member(db, board_id, user.id):
        raise HTTPException(403, "Not a member of this board")
    return task, board_id


async def ensure_assignable(db: AsyncSession, board_id: str, assignee_id: str | None) -> None:
    if assignee_id is not None and not await is_member(db, board_id, assignee_id):
        raise HTTPException(422, "Assignee must be a member of the board")


async def comment_counts(db: AsyncSession, task_ids: list[str]) -> dict[str, int]:
    if not task_ids:
        return {}
    rows = await db.execute(
        select(Comment.task_id, func.count(Comment.id)).where(Comment.task_id.in_(task_ids)).group_by(Comment.task_id)
    )
    return dict(rows.all())


async def task_response(db: AsyncSession, task_id: str) -> TaskResponse:
    task = await db.scalar(
        select(Task)
        .options(selectinload(Task.assignee), selectinload(Task.creator))
        .where(Task.id == task_id)
        .execution_options(populate_existing=True)
    )
    response = TaskResponse.model_validate(task)
    response.comment_count = (await comment_counts(db, [task_id])).get(task_id, 0)
    return response
