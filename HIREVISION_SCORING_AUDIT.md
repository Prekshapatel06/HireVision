# HIREVISION AI — COMPREHENSIVE SCORING AUDIT & MATHEMATICAL FORMULAS

This document provides a complete, deterministic, and explainable audit of every numerical score, percentage evaluation, and analytical metric in HireVision AI.

---

## 1. Candidate Profile Completeness (%)

| Property | Details |
| :--- | :--- |
| **Metric Name** | Profile Completeness |
| **Exact UI Label** | Profile Completeness / Complete % |
| **Source Files** | `frontend/src/app/dashboard/page.tsx`<br>`frontend/src/components/dashboard/OverviewSection.tsx` |
| **API Endpoint** | Evaluated on client from `GET /api/profiles/me` |
| **Database Fields** | `profiles.full_name`, `profiles.career_objective`, `profiles.email`, `profiles.phone`, `profiles.city`, `profiles.education`, `profiles.skills`, `profiles.projects`, `profiles.experience`, `profiles.internships`, `profiles.certifications` |
| **Criterion Weights** | • Full Name: **10%**<br>• Professional Career Objective: **10%**<br>• Contact Details (Email + Phone + City): **15%** (5% each)<br>• Higher Education (College/University): **15%**<br>• Skills (minimum 3 skills): **15%**<br>• Engineering Projects (minimum 1 project): **15%**<br>• Practical Experience (Internship or Employment): **10%**<br>• Validated Certifications: **10%** |
| **Formula** | $\text{Completeness} = W_{\text{name}} + W_{\text{obj}} + W_{\text{contact}} + W_{\text{edu}} + W_{\text{skills}} + W_{\text{proj}} + W_{\text{exp}} + W_{\text{certs}}$ |
| **Missing Values Policy** | Missing fields contribute 0% to their specific weighted allocation. No fabricated scores or simulated fallbacks. |
| **Example Calculation** | Candidate Preksha (User 2):<br>• Name: Yes (10%)<br>• Objective: Yes (10%)<br>• Contact: Email + Phone + City (15%)<br>• Education: B.Tech at P. P. Savani University (15%)<br>• Skills: 18 skills (15%)<br>• Projects: 1 project (15%)<br>• Experience: 1 Internship at SCC Infotech LLP (10%)<br>• Certifications: 3 certifications (10%)<br>**Result: 95%** (or 100% when all sub-fields populated). |

---

## 2. Resume Quality & ATS Compliance Score (%)

| Property | Details |
| :--- | :--- |
| **Metric Name** | Resume Quality / ATS Optimizer Score |
| **Exact UI Label** | Resume Quality / Compliance % |
| **Source Files** | `backend/services/ai/liveResumeAgent.js`<br>`frontend/src/components/dashboard/LiveResumeSection.tsx` |
| **API Endpoint** | `POST /api/ai/live-resume` |
| **Database Fields** | `profiles.career_objective`, `profiles.skills`, `profiles.projects`, `profiles.education`, `profiles.experience`, `profiles.internships` |
| **Criterion Weights** | • Full Candidate Identification & Title: **15%**<br>• Career Objective & Professional Statement (>20 chars): **15%**<br>• Key Technical & Soft Skills (>=4 skills): **20%**<br>• Key Engineering Projects (>=2 projects = 20%, 1 project = 10%): **20%**<br>• Higher Education (College/University Degree & CGPA): **15%**<br>• Internship or Professional Experience: **15%** |
| **Formula** | $\text{ResumeQuality} = \sum_{i=1}^{6} \text{EvidenceWeight}_i \quad (\text{Bounded between } 0 \text{ and } 100)$ |
| **Missing Values Policy** | If candidate has 0 evidence points, returns "Not Analyzed" / null. Never produces random numbers. |
| **Example Calculation** | Preksha (User 2):<br>• ID + Contact: 15%<br>• Career Objective: 15%<br>• Skills (18): 20%<br>• Projects (1): 10%<br>• Education (P P Savani Univ): 15%<br>• Internship (SCC Infotech LLP): 15%<br>**Result: 90%** |

---

## 3. Skill Proficiency Score (%) & Level Assessment

| Property | Details |
| :--- | :--- |
| **Metric Name** | Skill Proficiency Score |
| **Exact UI Label** | Proficiency: X% • Level (Beginner / Developing / Intermediate / Strong / Expert) |
| **Source Files** | `backend/services/ai/skillAgent.js`<br>`backend/controllers/aiController.js` |
| **API Endpoint** | `POST /api/ai/analyze-skills`<br>`GET /api/ai/skill-analysis` |
| **Database Fields** | `profiles.skills` (name + candidate declared level: Expert/Intermediate/Beginner), `profiles.projects`, `profiles.internships`, `profiles.experience`, `profiles.certifications` |
| **Formula** | $\text{Proficiency} = \text{Base}(\text{DeclaredLevel}) + \Delta_{\text{projects}} + \Delta_{\text{internships}} + \Delta_{\text{certs}}$ |
| **Base Score by Declared Level** | • **Expert / Advanced**: 78% base<br>• **Intermediate**: 68% base<br>• **Beginner**: 48% base<br>• **Unspecified / General**: 55% base |
| **Evidence Additions** | • **Project Evidence**: $+8\%$ per demonstrated project (capped at $+15\%$).<br>• **Work / Internship Evidence**: $+7\%$ per practical application (capped at $+12\%$).<br>• **Certification Evidence**: $+6\%$ per validating certification (capped at $+10\%$). |
| **Output Level Thresholds** | • $\ge 80\% \implies \text{Strong / Expert}$<br>• $\ge 65\% \implies \text{Intermediate / Proficient}$<br>• $\ge 45\% \implies \text{Developing}$<br>• $< 45\% \implies \text{Beginner}$ |
| **Root Cause of Prior Flat 60% Bug** | The prior code defaulted all skills to 60% "Developing" unless the skill name was an exact literal substring of `projectsText` or `certsText`, while completely ignoring `skill.level`, `internships`, and `experience`. |
| **Correction Result** | Every skill now reflects candidate declared proficiency combined with real project, internship, and certification evidence. |

---

## 4. Project Quality Analytics (%)

| Property | Details |
| :--- | :--- |
| **Metric Name** | Project Quality Analytics |
| **Exact UI Label** | Overall Quality / Technical Depth / Career Relevance / Description Quality |
| **Source Files** | `backend/services/ai/projectAgent.js`<br>`backend/controllers/aiController.js` |
| **API Endpoint** | `POST /api/ai/analyze-projects`<br>`GET /api/ai/project-analysis` |
| **Database Fields** | `profiles.projects` (`title`, `description`, `technologies`, `role`, `github_link`, `live_link`, `features`, `outcome`) |
| **Overall Formula** | $\text{Overall Quality} = \text{round}(0.40 \times \text{TechDepth} + 0.35 \times \text{Relevance} + 0.25 \times \text{DescriptionQuality})$ |
| **1. Technical Depth (0 - 100)** | • Tech stack variety: 4+ tools $= 35\%$, 2-3 tools $= 25\%$, 1 tool $= 15\%$<br>• Public GitHub repository link: $+25\%$<br>• Live demonstration / Deployment link: $+15\%$<br>• Architecture / Role details / Long description: $+15\%$<br>• Explicit features list: $+10\%$<br>*(Bounded: 25% - 95%)* |
| **2. Career Relevance (0 - 100)** | • Baseline software utility: $40\%$<br>• In-demand modern stack matching (AI/ML, React, Next, Node, Python, Postgres, etc.): $+8\%$ per match (max $+32\%$)<br>• Production deployment presence: $+15\%$<br>• Real-world software scope: $+10\%$<br>*(Bounded: 30% - 95%)* |
| **3. Description Quality (0 - 100)** | • Baseline: $20\%$<br>• Detail length: $>300$ chars $= 40\%$, $>150$ chars $= 25\%$, $>50$ chars $= 15\%$<br>• Structured formatting (bullet points, sections): $+20\%$<br>• Measurable outcomes / impact statements: $+20\%$<br>*(Bounded: 25% - 95%)* |
| **Insufficient Data Policy** | If candidate supplies only a title with $<25$ characters description, no technologies, and no repository/live links, the system displays an amber **`Insufficient Data`** badge instead of assigning an arbitrary or punitive $0\%$. |
| **Real-Time Auto-Sync** | 1. Profile updates (`PUT /api/profile`) automatically trigger fresh project analysis and refresh `ai_project_analysis` in PostgreSQL, eliminating stale cache.<br>2. `GET /api/ai/analysis` checks for missing projects or outdated $0\%$ rows against current `profiles.projects` and auto-syncs on demand. |
| **Candidate Real-World Results** | • **HireVision AI**: **89% Overall Quality** (Tech Depth: 90%, Career Relevance: 95%, Description Quality: 80%)<br>• **AI System Health Dashboard**: **66% Overall Quality** (Tech Depth: 40% [missing repository and live links], Career Relevance: 74%, Description Quality: 95%) |
| **Root Cause of Prior 0% Bug** | 1. `normalizeProject` only checked `project.github_url` and `project.live_url`, whereas candidate forms save `github_link` and `live_link`.<br>2. `normalizeProjectAnalysis` fallback in old code forced missing or fuzzy matches to $0\%$ with generic message `"Insufficient analysis evidence available."`.<br>3. Outdated `ai_project_analysis` database rows were cached and never auto-invalidated when candidate updated profile projects. |
| **Correction Result** | Fully mapped URL fields, added case-insensitive fuzzy title matching, implemented deterministic `calculateLocalProjectScore`, added automatic PostgreSQL cache invalidation, and replaced arbitrary 0% with `Insufficient Data` status. |

---

## 5. Candidate-Job Match Score (%)

| Property | Details |
| :--- | :--- |
| **Metric Name** | Candidate-Job Match Percentage |
| **Exact UI Label** | Match Score: X% |
| **Source Files** | `backend/services/ai/recruiterOrchestrator.js`<br>`backend/controllers/recruiterController.js` |
| **API Endpoint** | `POST /api/recruiter/match-candidate`<br>`GET /api/recruiter/jobs/:jobId/candidates` |
| **Database Fields** | `jobs.requirements` (`must_have`, `preferred`), `profiles.skills`, `profiles.projects`, `profiles.experience`, `profiles.internships` |
| **Criterion Weights** | • Must-Have Core Skills Matched: **50%**<br>• Preferred & Additional Technical Competencies: **20%**<br>• Project Implementation Evidence: **15%**<br>• Practical Work / Internship Experience: **15%** |
| **Formula** | $\text{MatchScore} = \left(\frac{\text{MatchedMustHave}}{\text{TotalMustHave}} \times 50\right) + \left(\frac{\text{MatchedPreferred}}{\text{TotalPreferred}} \times 20\right) + \text{Evidence}_{\text{proj}} + \text{Evidence}_{\text{exp}}$ |
| **Missing Values Policy** | Missing candidate skills or unverified requirements explicitly lower the match score. No arbitrary random values or hardcoded 75%/85% scores. |

---

## 6. AI Career Readiness Score (%)

| Property | Details |
| :--- | :--- |
| **Metric Name** | AI Career Readiness |
| **Exact UI Label** | Readiness Score: X% |
| **Source Files** | `backend/services/ai/careerReadinessAgent.js` |
| **API Endpoint** | `GET /api/ai/career-readiness`<br>`POST /api/ai/analyze-readiness` |
| **Database Fields** | `ai_career_readiness.readiness_score`, `profile_quality`, `skill_strength`, `project_strength`, `resume_quality`, `career_fit` |
| **Formula** | $\text{ReadinessScore} = 0.25 \times \text{ProfileQuality} + 0.25 \times \text{SkillStrength} + 0.20 \times \text{ProjectStrength} + 0.15 \times \text{ResumeQuality} + 0.15 \times \text{CareerFit}$ |
| **Transparency** | Separates generic profile completion (e.g. 95%) from technical role readiness (e.g. 78%) based on target engineering position requirements. |
