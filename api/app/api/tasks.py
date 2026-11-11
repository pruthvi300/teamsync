from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, func, select, update

from app.api.access import column_for_member, ensure_assignable, task_for_member, task_response
from app.core.dependencies import CurrentUser, DbSession
from app.models.column import Column
from app.models.comment import Comment
from app.models.task import Task
from app.schemas.board import TaskCreate, TaskMove, TaskResponse, TaskUpdate
from app.services.websocket import broadcast

router = APIRouter()


async def _task_count(db, column_id: str) -> int:
    return await db.scalar(select(func.count(Task.id)).where(Task.column_id == column_id)) or 0


def _check_wip(column: Column, current_count: int) -> None:
    if column.wip_limit and current_count >= column.wip_limit:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Column '{column.title}' has reached its WIP limit of {column.wip_limit}"
        )


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(task_data: TaskCreate, db: DbSession, current_user: CurrentUser):
    """Add a task at the bottom of a column, respecting the WIP limit."""
    column = await column_for_member(db, task_data.column_id, current_user, lock=True)
    await ensure_assignable(db, column.board_id, task_data.assignee_id)
    count = await _task_count(db, column.id)
    _check_wip(column, count)
    task = Task(**task_data.model_dump(), creator_id=current_user.id, position=count)
    db.add(task)
    await db.commit()
    response = await task_response(db, task.id)
    await broadcast(column.board_id, "task:created", response.model_dump(mode="json"), current_user.id)
    return response


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, db: DbSession, current_user: CurrentUser):
    await task_for_member(db, task_id, current_user)
    return await task_response(db, task_id)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_data: TaskUpdate, db: DbSession, current_user: CurrentUser):
    task, board_id = await task_for_member(db, task_id, current_user)
    changes = task_data.model_dump(exclude_unset=True)
    if "assignee_id" in changes:
        await ensure_assignable(db, board_id, changes["assignee_id"])
    for field, value in changes.items():
        setattr(task, field, value)
    await db.commit()
    response = await task_response(db, task_id)
    await broadcast(board_id, "task:updated", response.model_dump(mode="json"), current_user.id)
    return response


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: str, db: DbSession, current_user: CurrentUser):
    task, board_id = await task_for_member(db, task_id, current_user)
    column_id, position = task.column_id, task.position
    await db.execute(delete(Comment).where(Comment.task_id == task_id))
    await db.delete(task)
    await db.flush()
    # Close the gap so positions stay 0..n-1.
    await db.execute(
        update(Task).where(Task.column_id == column_id, Task.position > position).values(position=Task.position - 1)
    )
    await db.commit()
    await broadcast(board_id, "task:deleted", {"task_id": task_id, "column_id": column_id}, current_user.id)


@router.put("/{task_id}/move", response_model=TaskResponse)
async def move_task(task_id: str, move: TaskMove, db: DbSession, current_user: CurrentUser):
    """
    Drag-and-drop: move a task to (column, position) within the same board.

    Positions in both columns stay contiguous (0..n-1). The target position is
    clamped to the end of the destination column. Column rows are locked so two
    concurrent moves into the same column can't interleave.
    """
    task, board_id = await task_for_member(db, task_id, current_user)
    source = await column_for_member(db, task.column_id, current_user, lock=True)
    dest = (
        source if move.column_id == source.id else await column_for_member(db, move.column_id, current_user, lock=True)
    )
    if dest.board_id != board_id:
        raise HTTPException(422, "Tasks can only move within the same board")

    old_position = task.position
    if dest.id == source.id:
        new_position = min(move.position, await _task_count(db, source.id) - 1)
        if new_position > old_position:
            await db.execute(
                update(Task)
                .where(Task.column_id == source.id, Task.position > old_position, Task.position <= new_position)
                .values(position=Task.position - 1)
            )
        elif new_position < old_position:
            await db.execute(
                update(Task)
                .where(Task.column_id == source.id, Task.position >= new_position, Task.position < old_position)
                .values(position=Task.position + 1)
            )
    else:
        dest_count = await _task_count(db, dest.id)
        _check_wip(dest, dest_count)
        new_position = min(move.position, dest_count)
        await db.execute(
            update(Task)
            .where(Task.column_id == source.id, Task.position > old_position)
            .values(position=Task.position - 1)
        )
        await db.execute(
            update(Task)
            .where(Task.column_id == dest.id, Task.position >= new_position)
            .values(position=Task.position + 1)
        )

    await db.execute(update(Task).where(Task.id == task_id).values(column_id=dest.id, position=new_position))
    await db.commit()
    response = await task_response(db, task_id)
    await broadcast(
        board_id,
        "task:moved",
        {"task_id": task_id, "from_column": source.id, "to_column": dest.id, "position": new_position},
        current_user.id,
    )
    return response
