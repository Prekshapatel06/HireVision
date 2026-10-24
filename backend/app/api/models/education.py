from pydantic import BaseModel
from typing import Optional

class Education(BaseModel):
    school_name: Optional[str] = ""
    board: Optional[str] = ""
    school_passing_year: Optional[int] = None
    percentage: Optional[str] = ""
    college_name: Optional[str] = ""
    university: Optional[str] = ""
    degree: Optional[str] = ""
    branch: Optional[str] = ""
    semester: Optional[str] = ""
    cgpa: Optional[str] = ""
    college_passing_year: Optional[int] = None
