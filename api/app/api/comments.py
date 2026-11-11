from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.access import task_for_member
from app.core.dependencies import CurrentUser, DbSession
from app.models.column import Column
from app.models.comment import Comment
from app.models.task import Task
from app.schemas.board import CommentCreate, CommentResponse
from app.services.websocket import broadcast

router = APIRouter()


async def _comment_response(db, comment_id: str) -> CommentResponse:
    comment = await db.scalar(select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment_id))
    return CommentResponse.model_validate(comment)


@router.post("/", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(comment_data: CommentCreate, db: DbSession, current_user: CurrentUser):
    _, board_id = await task_for_member(db, comment_data.task_id, current_user)
    comment = Comment(content=comment_data.content, task_id=comment_data.task_id, author_id=current_user.id)
    db.add(comment)
    await db.commit()
    response = await _comment_response(db, comment.id)
    await broadcast(board_id, "comment:created", response.model_dump(mode="json"), current_user.id)
    return response


@router.get("/{task_id}", response_model=list[CommentResponse])
async def list_comments(task_id: str, db: DbSession, current_user: CurrentUser):
    await task_for_member(db, task_id, current_user)
    comments = await db.scalars(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.task_id == task_id)
        .order_by(Comment.created_at.asc())
    )
    return comments.all()


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(comment_id: str, db: DbSession, current_user: CurrentUser):
    """Only the author can delete a comment."""
    row = (
        await db.execute(
            select(Comment, Column.board_id)
            .join(Task, Comment.task_id == Task.id)
            .join(Column, Task.column_id == Column.id)
            .where(Comment.id == comment_id)
        )
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    comment, board_id = row
    if comment.author_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own comments")
    task_id = comment.task_id
    await db.delete(comment)
    await db.commit()
    await broadcast(board_id, "comment:deleted", {"comment_id": comment_id, "task_id": task_id}, current_user.id)
