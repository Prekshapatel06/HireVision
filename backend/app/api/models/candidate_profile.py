from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional, List, Dict, Any

class CandidateProfile(BaseModel):
    id: int
    user_id: int
    full_name: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    profile_photo: Optional[str] = None
    career_objective: Optional[str] = None
    education: Optional[List[Dict[str, Any]]] = []
    skills: Optional[Any] = {}
    projects: Optional[List[Dict[str, Any]]] = []
    internships: Optional[List[Dict[str, Any]]] = []
    experience: Optional[List[Dict[str, Any]]] = []
    certifications: Optional[List[Dict[str, Any]]] = []
    achievements: Optional[List[str]] = []
    languages: Optional[List[Dict[str, Any]]] = []
    social_profiles: Optional[Dict[str, str]] = {}
    resume_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
