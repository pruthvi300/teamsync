from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from app.schemas.user import UserResponse

HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
Priority = Literal["critical", "high", "medium", "low"]
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


# ── Boards ───────────────────────────────────────────────────────────────────


class BoardCreate(BaseModel):
    title: Annotated[Title, Field(max_length=200)]
    description: str = Field(default="", max_length=1000)
    background_color: HexColor = "#6366f1"


class BoardUpdate(BaseModel):
    title: Annotated[Title, Field(max_length=200)] | None = None
    description: str | None = Field(default=None, max_length=1000)
    background_color: HexColor | None = None
    is_archived: bool | None = None


class MemberAdd(BaseModel):
    email: EmailStr


class BoardResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str | None
    background_color: str
    owner_id: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    owner: UserResponse
    members: list[UserResponse] = []


class BoardListResponse(BaseModel):
    id: str
    title: str
    description: str | None
    background_color: str
    owner_id: str
    is_archived: bool
    created_at: datetime
    member_count: int


# ── Columns ──────────────────────────────────────────────────────────────────


class ColumnCreate(BaseModel):
    title: Annotated[Title, Field(max_length=100)]
    color: HexColor = "#6366f1"
    wip_limit: int = Field(default=0, ge=0, le=1000)
    board_id: str


class ColumnUpdate(BaseModel):
    title: Annotated[Title, Field(max_length=100)] | None = None
    color: HexColor | None = None
    wip_limit: int | None = Field(default=None, ge=0, le=1000)


class ColumnReorder(BaseModel):
    """Every column id of the board, in the new order."""

    column_ids: list[str] = Field(min_length=1)


# ── Tasks ────────────────────────────────────────────────────────────────────


class TaskCreate(BaseModel):
    title: Annotated[Title, Field(max_length=300)]
    description: str = Field(default="", max_length=10_000)
    priority: Priority = "medium"
    labels: list[Label] = Field(default_factory=list, max_length=10)
    due_date: datetime | None = None
    column_id: str
    assignee_id: str | None = None


class TaskUpdate(BaseModel):
    title: Annotated[Title, Field(max_length=300)] | None = None
    description: str | None = Field(default=None, max_length=10_000)
    priority: Priority | None = None
    labels: list[Label] | None = Field(default=None, max_length=10)
    due_date: datetime | None = None
    assignee_id: str | None = None


class TaskMove(BaseModel):
    column_id: str
    position: int = Field(ge=0)


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str | None
    position: int
    priority: str
    labels: list[str]
    due_date: datetime | None
    column_id: str
    assignee_id: str | None
    creator_id: str
    created_at: datetime
    updated_at: datetime
    assignee: UserResponse | None = None
    creator: UserResponse | None = None
    comment_count: int = 0


class ColumnResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    position: int
    color: str
    wip_limit: int
    board_id: str
    created_at: datetime
    tasks: list[TaskResponse] = []


class BoardDetailResponse(BoardResponse):
    columns: list[ColumnResponse] = []


# ── Comments ─────────────────────────────────────────────────────────────────


class CommentCreate(BaseModel):
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]
    task_id: str


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    content: str
    task_id: str
    author_id: str
    created_at: datetime
    updated_at: datetime
    author: UserResponse | None = None
