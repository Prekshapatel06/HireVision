import os
import time
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from psycopg2.extensions import connection
from ..db.database import get_db
from ..schemas.candidate_profile_schema import ProfileUpdate
from ..services.candidate_profile_service import get_candidate_profile, update_candidate_profile, update_resume_url
from ..middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/api/profile", tags=["profile"])

@router.get("")
def get_profile(current_user: dict = Depends(get_current_user), db: connection = Depends(get_db)):
    return get_candidate_profile(db, current_user["id"])

@router.put("")
def update_profile(profile_data: ProfileUpdate, current_user: dict = Depends(get_current_user), db: connection = Depends(get_db)):
    return update_candidate_profile(db, current_user["id"], profile_data)

@router.post("/upload-resume")
async def upload_resume(
    resume: UploadFile = File(...), 
    current_user: dict = Depends(get_current_user), 
    db: connection = Depends(get_db)
):
    if resume.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type, only PDF is allowed!")
        
    MAX_FILE_SIZE = 10 * 1024 * 1024 # 10MB limit matching Express/Multer limits
    content = await resume.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large, max size 10MB.")
        
    uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads"))
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir, exist_ok=True)
        
    # Generate unique name resume-userId-timestamp.pdf
    unique_suffix = f"{current_user['id']}-{int(time.time() * 1000)}"
    file_name = f"resume-{unique_suffix}.pdf"
    file_path = os.path.join(uploads_dir, file_name)
    
    with open(file_path, "wb") as f:
        f.write(content)
        
    resume_url = f"/uploads/{file_name}"
    return update_resume_url(db, current_user["id"], resume_url)
