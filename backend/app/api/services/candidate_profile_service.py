from fastapi import HTTPException
from ..db.database import query
import json

def get_candidate_profile(conn, user_id):
    profile_res = query(
        conn,
        "SELECT p.*, u.email FROM profiles p JOIN users u ON p.user_id = u.id WHERE p.user_id = %s",
        (user_id,)
    )
    if profile_res.rowCount == 0:
        raise HTTPException(status_code=404, detail="Profile not found.")
    
    # Return profile directly.
    return profile_res.rows[0]

def update_candidate_profile(conn, user_id, profile_data):
    # Check if profile exists, if not seed first
    profile_check = query(conn, "SELECT id FROM profiles WHERE user_id = %s", (user_id,))
    if profile_check.rowCount == 0:
        query(conn, "INSERT INTO profiles (user_id) VALUES (%s)", (user_id,))
        
    # Helper to serialize fields
    def to_json_str(val, default):
        if val is None:
            return json.dumps(default)
        return json.dumps(val)

    # Set parameters matching the raw sql in Express
    dob_val = profile_data.dob if profile_data.dob else None
    
    update_res = query(
        conn,
        """
        UPDATE profiles SET
            full_name = %s,
            phone = %s,
            dob = %s,
            gender = %s,
            address = %s,
            city = %s,
            state = %s,
            country = %s,
            profile_photo = %s,
            career_objective = %s,
            education = %s,
            skills = %s,
            projects = %s,
            internships = %s,
            experience = %s,
            certifications = %s,
            achievements = %s,
            languages = %s,
            social_profiles = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = %s
        RETURNING *
        """,
        (
            profile_data.full_name,
            profile_data.phone,
            dob_val,
            profile_data.gender,
            profile_data.address,
            profile_data.city,
            profile_data.state,
            profile_data.country,
            profile_data.profile_photo,
            profile_data.career_objective,
            to_json_str(profile_data.education, []),
            to_json_str(profile_data.skills, {}),
            to_json_str(profile_data.projects, []),
            to_json_str(profile_data.internships, []),
            to_json_str(profile_data.experience, []),
            to_json_str(profile_data.certifications, []),
            to_json_str(profile_data.achievements, []),
            to_json_str(profile_data.languages, []),
            to_json_str(profile_data.social_profiles, {}),
            user_id
        )
    )
    
    if update_res.rowCount == 0:
        raise HTTPException(status_code=500, detail="Server error updating profile data.")
        
    return {
        "message": "Profile updated successfully",
        "profile": update_res.rows[0]
    }

def update_resume_url(conn, user_id, resume_url):
    query(
        conn,
        "UPDATE profiles SET resume_url = %s, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s",
        (resume_url, user_id)
    )
    return {
        "message": "Resume PDF uploaded successfully",
        "resume_url": resume_url
    }
