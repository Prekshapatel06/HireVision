from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class User(BaseModel):
    id: int
    username: str
    email: str
    role: str = "candidate"
    auth_provider: str = "local"
    google_id: Optional[str] = None
    microsoft_id: Optional[str] = None
    created_at: Optional[datetime] = None