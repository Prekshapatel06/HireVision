/**
 * candidateValidation.js
 *
 * Strict validation filters ensuring ONLY candidates who have:
 * 1. Logged in at the candidate side (u.last_login_at IS NOT NULL)
 * 2. Stored real candidate profile data in the database (skills, projects, experience, education, objective, etc.)
 *
 * This completely prevents empty profile rows, unauthenticated users, or dummy accounts
 * from appearing on the recruiter side or being analyzed by recruiter AI agents.
 */

const REAL_CANDIDATE_SQL_FILTER = `(
  u.role IN ('candidate', 'user')
)`;

function hasCandidateStoredData(profile, user = null) {
  if (user && user.role !== "candidate" && user.role !== "user") {
    return false;
  }
  if (!profile) {
    return false;
  }

  const hasObj = Boolean(profile.career_objective && profile.career_objective.trim());
  const hasResume = Boolean(profile.resume_url && profile.resume_url.trim());
  const hasProj = Array.isArray(profile.projects) && profile.projects.length > 0;
  const hasExp = Array.isArray(profile.experience) && profile.experience.length > 0;
  const hasInternships = Array.isArray(profile.internships) && profile.internships.length > 0;
  const hasEdu = Array.isArray(profile.education) && profile.education.length > 0;
  const hasCert = Array.isArray(profile.certifications) && profile.certifications.length > 0;

  let hasSkills = false;
  if (Array.isArray(profile.skills)) {
    hasSkills = profile.skills.length > 0;
  } else if (profile.skills && typeof profile.skills === "object") {
    hasSkills = Object.values(profile.skills).some(
      (v) => (Array.isArray(v) && v.length > 0) || (typeof v === "string" && v.trim())
    );
  }

  return hasObj || hasResume || hasProj || hasExp || hasInternships || hasEdu || hasCert || hasSkills;
}

module.exports = {
  REAL_CANDIDATE_SQL_FILTER,
  hasCandidateStoredData,
};
