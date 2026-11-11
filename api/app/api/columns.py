from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, func, select

from app.api.access import board_for_member, column_for_member
from app.core.dependencies import CurrentUser, DbSession
from app.models.column import Column
from app.models.comment import Comment
from app.models.task import Task
from app.schemas.board import ColumnCreate, ColumnReorder, ColumnResponse, ColumnUpdate
from app.services.websocket import broadcast

router = APIRouter()


def _column_payload(column: Column) -> dict:
    """Column without its tasks (the client already has them, or there are none yet)."""
    return ColumnResponse(
        id=column.id,
        title=column.title,
        position=column.position,
        color=column.color,
        wip_limit=column.wip_limit,
        board_id=column.board_id,
        created_at=column.created_at,
    ).model_dump(mode="json")


@router.post("/", response_model=ColumnResponse, status_code=status.HTTP_201_CREATED)
async def create_column(col_data: ColumnCreate, db: DbSession, current_user: CurrentUser):
    """Add a column at the end of the board."""
    await board_for_member(db, col_data.board_id, current_user)
    max_pos = await db.scalar(select(func.max(Column.position)).where(Column.board_id == col_data.board_id))
    column = Column(**col_data.model_dump(), position=0 if max_pos is None else max_pos + 1)
    db.add(column)
    await db.commit()
    payload = _column_payload(column)
    await broadcast(column.board_id, "column:created", payload, current_user.id)
    return payload


@router.put("/reorder/{board_id}")
async def reorder_columns(board_id: str, reorder: ColumnReorder, db: DbSession, current_user: CurrentUser):
    """Set column order. The list must contain every column of the board exactly once."""
    await board_for_member(db, board_id, current_user)
    columns = {c.id: c for c in (await db.scalars(select(Column).where(Column.board_id == board_id))).all()}
    if sorted(reorder.column_ids) != sorted(columns):
        raise HTTPException(422, "column_ids must list every column of the board once")
    for index, column_id in enumerate(reorder.column_ids):
        columns[column_id].position = index
    await db.commit()
    await broadcast(board_id, "column:reordered", {"column_ids": reorder.column_ids}, current_user.id)
    return {"ok": True}


@router.put("/{column_id}", response_model=ColumnResponse)
async def update_column(column_id: str, col_data: ColumnUpdate, db: DbSession, current_user: CurrentUser):
    column = await column_for_member(db, column_id, current_user)
    for field, value in col_data.model_dump(exclude_unset=True).items():
        setattr(column, field, value)
    await db.commit()
    payload = _column_payload(column)
    await broadcast(column.board_id, "column:updated", payload, current_user.id)
    return payload


@router.delete("/{column_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_column(column_id: str, db: DbSession, current_user: CurrentUser):
    """Delete a column with its tasks and their comments, then close the gap in positions."""
    column = await column_for_member(db, column_id, current_user)
    task_ids = select(Task.id).where(Task.column_id == column_id)
    await db.execute(delete(Comment).where(Comment.task_id.in_(task_ids)))
    await db.execute(delete(Task).where(Task.column_id == column_id))
    board_id, position = column.board_id, column.position
    await db.delete(column)
    for later in (
        await db.scalars(select(Column).where(Column.board_id == board_id, Column.position > position))
    ).all():
        later.position -= 1
    await db.commit()
    await broadcast(board_id, "column:deleted", {"column_id": column_id}, current_user.id)
