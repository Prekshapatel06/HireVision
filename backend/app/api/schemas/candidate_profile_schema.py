from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    profile_photo: Optional[str] = None
    career_objective: Optional[str] = None
    education: Optional[List[Dict[str, Any]]] = None
    skills: Optional[Any] = None
    projects: Optional[List[Dict[str, Any]]] = None
    internships: Optional[List[Dict[str, Any]]] = None
    experience: Optional[List[Dict[str, Any]]] = None
    certifications: Optional[List[Dict[str, Any]]] = None
    achievements: Optional[List[str]] = None
    languages: Optional[List[Dict[str, Any]]] = None
    social_profiles: Optional[Dict[str, str]] = None
