from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import CurrentUser, DbSession
from app.core.security import (
    REFRESH,
    burn_password_check,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.user import TokenRefreshRequest, TokenResponse, UserCreate, UserLogin, UserResponse

router = APIRouter()


def _tokens(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=UserResponse.model_validate(user),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: DbSession):
    if await db.scalar(select(User.id).where(User.email == user_data.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(email=user_data.email, username=user_data.username, hashed_password=hash_password(user_data.password))
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:  # concurrent registration with the same email
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered") from None
    return _tokens(user)


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: DbSession):
    user = await db.scalar(select(User).where(User.email == credentials.email))
    if user is None:
        burn_password_check(credentials.password)
    if user is None or not verify_password(credentials.password, user.hashed_password) or not user.is_active:
        # Same message for every failure, so the endpoint can't be used to discover accounts.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return _tokens(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: TokenRefreshRequest, db: DbSession):
    user_id = decode_token(request.refresh_token, REFRESH)
    user = await db.get(User, user_id) if user_id else None
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    return _tokens(user)


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser):
    return current_user
