import os
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import (
    FastAPI, Depends, HTTPException, status, Request, Response
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field

# In-memory storage for users and notes (for demo purposes)
fake_users_db = {}
fake_notes_db = []

# To be replaced with .env in production
SECRET_KEY = os.environ.get("SECRET_KEY", "super-long-hash-key-for-dev")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 configuration
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")


# -------------------- User and Auth Models --------------------

class UserBase(BaseModel):
    username: str = Field(..., description="Unique username for the account", min_length=2, max_length=32)

class UserCreate(UserBase):
    password: str = Field(..., description="Password (min 4 chars)", min_length=4)

class UserInDB(UserBase):
    hashed_password: str

class UserPublic(UserBase):
    pass

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# -------------------- Notes Models --------------------

class NoteBase(BaseModel):
    title: str = Field(..., description="Note title", max_length=200)
    content: str = Field("", description="Note content")

class NoteCreate(NoteBase):
    pass

class NoteUpdate(BaseModel):
    title: Optional[str] = Field(None, description="Title")
    content: Optional[str] = Field(None, description="Content")

class NoteOut(NoteBase):
    id: str = Field(..., description="Note ID")
    owner: str = Field(..., description="Username of the note's creator")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last updated timestamp")

# -------------------- Utility Functions --------------------

# PUBLIC_INTERFACE
def verify_password(plain_password, hashed_password):
    """Verify a plain password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)

# PUBLIC_INTERFACE
def get_password_hash(password):
    """Hash a password for storing."""
    return pwd_context.hash(password)

# PUBLIC_INTERFACE
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Generate a JWT access token.
    """
    data_copy = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    data_copy.update({"exp": expire})
    encoded_jwt = jwt.encode(data_copy, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_user(db, username: str):
    """Get a user from the database by username."""
    if username in db:
        user_dict = db[username]
        return UserInDB(**user_dict)
    return None

def authenticate_user(db, username: str, password: str):
    """Authenticate user and verify credentials."""
    user = get_user(db, username)
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

# PUBLIC_INTERFACE
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Get the currently authenticated user from a JWT token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials (token)",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(fake_users_db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

# -------------------- FastAPI Initialization --------------------

app = FastAPI(
    title="Notes API",
    description="Backend for Notes App - User authentication & CRUD notes",
    version="1.0.0",
    openapi_tags=[
        {"name": "auth", "description": "User registration and authentication"},
        {"name": "notes", "description": "CRUD operations for notes"}
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- AUTH ROUTES --------------------

@app.post("/api/register", response_model=UserPublic, status_code=201, tags=["auth"], summary="Register a new user", description="Create a new user account with username and password")
def register_user(user: UserCreate):
    """
    Register a new user.

    - **username**: Username for account (unique)
    - **password**: Password (at least 4 chars)
    """
    if user.username in fake_users_db:
        raise HTTPException(status_code=409, detail="Username already exists")
    hashed_pw = get_password_hash(user.password)
    fake_users_db[user.username] = {
        "username": user.username,
        "hashed_password": hashed_pw,
    }
    return UserPublic(username=user.username)

@app.post("/api/token", response_model=Token, tags=["auth"], summary="User login", description="Authenticate and get a JWT access token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Login to get an access token.

    Accepts form fields:
    - **username**: Username
    - **password**: Password

    Returns JWT access token.
    """
    user = authenticate_user(fake_users_db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/logout", tags=["auth"], summary="Logout (client-side only)", status_code=200, description="Invalidate current user session (client removes token)")
def logout():
    """
    Logout endpoint (stateless).
    Frontend removes token; backend does not maintain server-side sessions.
    """
    return {"detail": "Logout successful. Discard the token client-side."}

# -------------------- USER INFO ROUTE --------------------

@app.get("/api/me", response_model=UserPublic, tags=["auth"], summary="Get info about currently authenticated user")
def get_me(current_user: UserInDB = Depends(get_current_user)):
    """
    Returns info about the currently authenticated user.
    """
    return UserPublic(username=current_user.username)

# -------------------- NOTES ROUTES --------------------

@app.post("/api/notes", response_model=NoteOut, status_code=201, tags=["notes"], summary="Create a new note", description="Create a new note for the current user.")
def create_note(note: NoteCreate, current_user: UserInDB = Depends(get_current_user)):
    """
    Create a new note for this user.

    - title: note title (required)
    - content: note body (optional)
    """
    note_id = str(len(fake_notes_db) + 1) + "-" + str(int(datetime.utcnow().timestamp() * 1000))
    now = datetime.utcnow()
    note_dict = {
        "id": note_id,
        "title": note.title,
        "content": note.content,
        "owner": current_user.username,
        "created_at": now,
        "updated_at": now,
    }
    fake_notes_db.append(note_dict)
    return NoteOut(**note_dict)

@app.get("/api/notes", response_model=List[NoteOut], tags=["notes"], summary="List notes", description="Get all notes for the current user")
def list_notes(current_user: UserInDB = Depends(get_current_user)):
    """
    List all notes belonging to the currently authenticated user.
    """
    user_notes = [NoteOut(**n) for n in fake_notes_db if n["owner"] == current_user.username]
    # Sort newest first
    user_notes.sort(key=lambda n: n.updated_at, reverse=True)
    return user_notes

@app.get("/api/notes/{note_id}", response_model=NoteOut, tags=["notes"], summary="Get note by ID")
def get_note(note_id: str, current_user: UserInDB = Depends(get_current_user)):
    """
    Get a single note by its ID if it belongs to the current user.
    """
    for note in fake_notes_db:
        if note["id"] == note_id and note["owner"] == current_user.username:
            return NoteOut(**note)
    raise HTTPException(status_code=404, detail="Note not found")

@app.put("/api/notes/{note_id}", response_model=NoteOut, tags=["notes"], summary="Update note", description="Update an existing note")
def update_note(note_id: str, note_update: NoteUpdate, current_user: UserInDB = Depends(get_current_user)):
    """
    Update an existing note by its ID.

    - title/content are optional and only updated if present.
    """
    for note in fake_notes_db:
        if note["id"] == note_id and note["owner"] == current_user.username:
            if note_update.title is not None:
                note["title"] = note_update.title
            if note_update.content is not None:
                note["content"] = note_update.content
            note["updated_at"] = datetime.utcnow()
            return NoteOut(**note)
    raise HTTPException(status_code=404, detail="Note not found")

@app.delete("/api/notes/{note_id}", tags=["notes"], status_code=204, summary="Delete note", description="Delete a note by ID")
def delete_note(note_id: str, current_user: UserInDB = Depends(get_current_user)):
    """
    Delete a note belonging to the current user.
    """
    for i, note in enumerate(fake_notes_db):
        if note["id"] == note_id and note["owner"] == current_user.username:
            del fake_notes_db[i]
            return Response(status_code=status.HTTP_204_NO_CONTENT)
    raise HTTPException(status_code=404, detail="Note not found")

# -------------------- HEALTH CHECK --------------------

@app.get("/", tags=["health"], summary="API Healthcheck")
def health_check():
    """
    Simple health check.
    """
    return {"message": "Healthy"}

# -------------------- API USAGE/HELP --------------------

@app.get("/api/docs/websocket", tags=["auth"], include_in_schema=True,
         summary="WebSocket usage help", description="WebSocket not used in this API. All endpoints are REST.")
def websocket_usage():
    """
    This Notes API does not provide any WebSocket endpoints.
    """
    return {"message": "This API only supports REST endpoints; there are no WebSocket interfaces."}

# -------------------- Error Handlers --------------------

@app.exception_handler(HTTPException)
def custom_http_exception_handler(request: Request, exc: HTTPException):
    """
    Custom error formatting for HTTPException.
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# End of main.py
