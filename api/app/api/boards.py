from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from app.api.access import board_for_member, comment_counts
from app.core.dependencies import CurrentUser, DbSession
from app.models.board import Board, board_members
from app.models.column import Column
from app.models.comment import Comment
from app.models.task import Task
from app.models.user import User
from app.schemas.board import (
    BoardCreate,
    BoardDetailResponse,
    BoardListResponse,
    BoardResponse,
    BoardUpdate,
    MemberAdd,
)
from app.schemas.user import UserResponse
from app.services.websocket import broadcast

router = APIRouter()

DEFAULT_COLUMNS = [("To Do", "#6366f1"), ("In Progress", "#f59e0b"), ("Done", "#22c55e")]


async def _board_response(db, board_id: str) -> BoardResponse:
    board = await db.scalar(
        select(Board)
        .options(selectinload(Board.owner), selectinload(Board.members))
        .where(Board.id == board_id)
        .execution_options(populate_existing=True)
    )
    return BoardResponse.model_validate(board)


def _require_owner(board: Board, user: User, action: str) -> None:
    if board.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Only the owner can {action} this board")


@router.post("/", response_model=BoardResponse, status_code=status.HTTP_201_CREATED)
async def create_board(board_data: BoardCreate, db: DbSession, current_user: CurrentUser):
    """Create a board with the creator as owner and member, plus three default columns."""
    board = Board(**board_data.model_dump(), owner_id=current_user.id)
    db.add(board)
    await db.flush()
    await db.execute(board_members.insert().values(user_id=current_user.id, board_id=board.id, role="admin"))
    db.add_all(
        Column(title=title, color=color, position=i, board_id=board.id)
        for i, (title, color) in enumerate(DEFAULT_COLUMNS)
    )
    await db.commit()
    return await _board_response(db, board.id)


@router.get("/", response_model=list[BoardListResponse])
async def list_boards(db: DbSession, current_user: CurrentUser, include_archived: bool = False):
    """Boards the user belongs to, with member counts computed in SQL (no per-board queries)."""
    counted = board_members.alias("counted")
    member_count = (
        select(func.count())
        .select_from(counted)
        .where(counted.c.board_id == Board.id)
        .correlate(Board)
        .scalar_subquery()
    )
    query = (
        select(Board, member_count)
        .join(board_members, board_members.c.board_id == Board.id)
        .where(board_members.c.user_id == current_user.id)
        .order_by(Board.updated_at.desc())
    )
    if not include_archived:
        query = query.where(Board.is_archived.is_(False))
    rows = (await db.execute(query)).all()
    return [
        BoardListResponse(
            id=b.id,
            title=b.title,
            description=b.description,
            background_color=b.background_color,
            owner_id=b.owner_id,
            is_archived=b.is_archived,
            created_at=b.created_at,
            member_count=count,
        )
        for b, count in rows
    ]


@router.get("/{board_id}", response_model=BoardDetailResponse)
async def get_board(board_id: str, db: DbSession, current_user: CurrentUser):
    """The whole Kanban board (columns and tasks, ordered) in one response."""
    await board_for_member(db, board_id, current_user)
    board = await db.scalar(
        select(Board)
        .options(
            selectinload(Board.owner),
            selectinload(Board.members),
            selectinload(Board.columns).selectinload(Column.tasks).selectinload(Task.assignee),
            selectinload(Board.columns).selectinload(Column.tasks).selectinload(Task.creator),
        )
        .where(Board.id == board_id)
        .execution_options(populate_existing=True)
    )
    response = BoardDetailResponse.model_validate(board)
    counts = await comment_counts(db, [t.id for c in response.columns for t in c.tasks])
    for column in response.columns:
        for task in column.tasks:
            task.comment_count = counts.get(task.id, 0)
    return response


@router.put("/{board_id}", response_model=BoardResponse)
async def update_board(board_id: str, board_data: BoardUpdate, db: DbSession, current_user: CurrentUser):
    board = await board_for_member(db, board_id, current_user)
    _require_owner(board, current_user, "update")
    for field, value in board_data.model_dump(exclude_unset=True).items():
        setattr(board, field, value)
    await db.commit()
    response = await _board_response(db, board_id)
    await broadcast(board_id, "board:updated", response.model_dump(mode="json"), current_user.id)
    return response


@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_board(board_id: str, db: DbSession, current_user: CurrentUser):
    """Delete the board and everything in it, children first (works with or without FK cascades)."""
    board = await board_for_member(db, board_id, current_user)
    _require_owner(board, current_user, "delete")
    column_ids = select(Column.id).where(Column.board_id == board_id)
    task_ids = select(Task.id).where(Task.column_id.in_(column_ids))
    await db.execute(delete(Comment).where(Comment.task_id.in_(task_ids)))
    await db.execute(delete(Task).where(Task.column_id.in_(column_ids)))
    await db.execute(delete(Column).where(Column.board_id == board_id))
    await db.execute(delete(board_members).where(board_members.c.board_id == board_id))
    await db.delete(board)
    await db.commit()
    await broadcast(board_id, "board:deleted", {"board_id": board_id}, current_user.id)


@router.post("/{board_id}/members", response_model=BoardResponse)
async def add_member(board_id: str, body: MemberAdd, db: DbSession, current_user: CurrentUser):
    board = await board_for_member(db, board_id, current_user)
    _require_owner(board, current_user, "add members to")
    user = await db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No user with that email")
    if await db.scalar(
        select(func.count())
        .select_from(board_members)
        .where(board_members.c.board_id == board_id, board_members.c.user_id == user.id)
    ):
        raise HTTPException(status.HTTP_409_CONFLICT, "User is already a member")
    await db.execute(board_members.insert().values(user_id=user.id, board_id=board_id, role="member"))
    await db.commit()
    response = await _board_response(db, board_id)
    await broadcast(
        board_id, "member:added", {"user": UserResponse.model_validate(user).model_dump(mode="json")}, current_user.id
    )
    return response
