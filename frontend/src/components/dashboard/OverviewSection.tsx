import React from "react";
import {
  Zap,
  Mail,
  Phone,
  Code,
  FolderGit2,
  Briefcase,
  Award,
  ExternalLink,
  GraduationCap,
  Network,
  FileSpreadsheet,
} from "lucide-react";

import { Profile } from "@/types/profile";

interface OverviewSectionProps {
  profile: Profile;
  calculateCompletion: () => number;
  countSkills: () => number;
  formattedDate: string;
}

export default function OverviewSection({
  profile,
  calculateCompletion,
  countSkills,
  formattedDate,
}: OverviewSectionProps) {
  const completionPct = calculateCompletion();
  const totalSkills = countSkills();
  const totalProjects = profile.projects?.length || 0;
  const totalExperience = profile.experience?.length || 0;
  const totalCertifications = profile.certifications?.length || 0;
  const totalInternships = profile.internships?.length || 0;

  // Find college/university education record (Part B1 & A1)
  const collegeEdu =
    profile.education?.find((e: any) => e.college_name || e.university) ||
    profile.education?.[0] ||
    ({} as any);

  const collegeName =
    collegeEdu.college_name?.trim() ||
    collegeEdu.university?.trim() ||
    "P. P. Savani University";

  // Separate technical and soft skills (Part A3)
  const softSkillKeywords = new Set([
    "communication",
    "teamwork",
    "problem solving",
    "problem-solving",
    "adaptability",
    "leadership",
    "time management",
    "quick learning ability",
    "critical thinking",
    "collaboration",
    "work ethic",
    "interpersonal skills",
    "emotional intelligence",
    "decision making",
    "conflict resolution",
    "negotiation",
    "presentation skills",
    "public speaking",
    "listening",
    "creativity"
  ]);

  const technicalSkills: Array<{ name: string; level?: string }> = [];
  const softSkills: Array<{ name: string; level?: string }> = [];

  (profile.skills || []).forEach((sk: any) => {
    const name = String(sk?.name || sk || "").trim();
    const level = typeof sk === "object" ? sk.level : "Intermediate";
    if (!name) return;

    if (softSkillKeywords.has(name.toLowerCase())) {
      softSkills.push({ name, level });
    } else {
      technicalSkills.push({ name, level });
    }
  });

  // Dynamically compute resume quality score based on verified candidate profile evidence
  const calculateResumeQuality = () => {
    let score = 0;
    let evidencePoints = 0;

    if (profile.full_name?.trim()) {
      score += 15;
      evidencePoints++;
    }
    if (profile.career_objective?.trim()) {
      score += profile.career_objective.trim().length > 20 ? 15 : 5;
      evidencePoints++;
    }
    const skillCount = profile.skills?.length || 0;
    if (skillCount >= 4) {
      score += 20;
      evidencePoints++;
    } else if (skillCount > 0) {
      score += skillCount * 5;
      evidencePoints++;
    }

    const projectCount = profile.projects?.length || 0;
    if (projectCount >= 2) {
      score += 20;
      evidencePoints++;
    } else if (projectCount === 1) {
      score += 10;
      evidencePoints++;
    }

    const eduCount = profile.education?.length || 0;
    if (eduCount > 0) {
      score += 15;
      evidencePoints++;
    }

    const expCount = (profile.experience?.length || 0) + (profile.internships?.length || 0);
    const certCount = profile.certifications?.length || 0;
    if (expCount > 0) {
      score += 15;
      evidencePoints++;
    } else if (certCount > 0) {
      score += Math.min(certCount * 5, 15);
      evidencePoints++;
    }

    if (evidencePoints === 0) {
      return { score: null, label: "Not Analyzed" };
    }
    return { score, label: `${score}/100` };
  };

  const resumeQuality = calculateResumeQuality();

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="premium-card p-6 md:p-8 bg-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm border border-purple-100">
        <div className="flex items-center gap-5">
          {profile.profile_photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profile_photo}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover border-2 border-purple-100 shadow-sm"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-poppins font-black text-xl border-2 border-purple-50">
              {profile.full_name?.substring(0, 2).toUpperCase() || "HV"}
            </div>
          )}

          <div>
            <h2 className="font-poppins font-extrabold text-xl text-slate-800">
              Welcome back, {profile.full_name || "Candidate"}! 👋
            </h2>

            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              {formattedDate}
            </p>
          </div>
        </div>

        <div className="px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-xs font-bold flex items-center gap-1.5 border border-purple-100">
          <Zap className="h-4 w-4 fill-purple-600 text-purple-600" />
          Live Profile Sync Active
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Profile Completion */}
        <div className="premium-card p-5 bg-white border-l-4 border-l-purple-500">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Profile Completion
          </span>

          <div className="flex items-center gap-2">
            <h3 className="font-poppins font-black text-xl text-slate-800">
              {completionPct}%
            </h3>

            <div className="flex-1 bg-purple-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
              <div
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 h-full transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* AI Resume Score */}
        <div className="premium-card p-5 bg-white border-l-4 border-l-purple-500">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            AI Resume Score
          </span>

          <div className="flex items-center gap-1">
            <Zap className="h-4 w-4 text-purple-500 fill-purple-500" />

            <h3 className="font-poppins font-black text-xl text-purple-600">
              {resumeQuality.label}
            </h3>
          </div>
        </div>

        {/* Skills & Projects */}
        <div className="premium-card p-5 bg-white border-l-4 border-l-purple-500">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Skills & Projects
          </span>

          <h3 className="font-poppins font-black text-xl text-slate-800">
            {totalSkills} Skills / {totalProjects} Proj
          </h3>
        </div>

        {/* Experience & Certifications */}
        <div className="premium-card p-5 bg-white border-l-4 border-l-purple-500">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Experience & Certs
          </span>

          <h3 className="font-poppins font-black text-xl text-slate-800">
            {totalExperience > 0 ? `${totalExperience} Job${totalExperience > 1 ? "s" : ""} • ` : ""}
            {totalInternships > 0 ? `${totalInternships} Internship${totalInternships > 1 ? "s" : ""}` : (totalExperience === 0 ? "0 Experience" : "")} /{" "}
            {totalCertifications} Cert{totalCertifications === 1 ? "" : "s"}
          </h3>
        </div>
      </div>

      {/* Profile Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column Profile Card */}
        <div className="premium-card p-6 bg-white space-y-6 lg:col-span-1 border border-purple-100 h-fit">
          <div className="text-center space-y-3 pb-6 border-b border-purple-100">
            {profile.profile_photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profile_photo}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-4 border-purple-50 shadow-md mx-auto"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center font-poppins font-black text-2xl border-4 border-purple-100 mx-auto">
                {profile.full_name?.substring(0, 2).toUpperCase() || "HV"}
              </div>
            )}

            <div>
              <h3 className="font-poppins font-extrabold text-lg text-slate-800">
                {profile.full_name || "Anonymous Candidate"}
              </h3>

              <p className="text-xs text-slate-400 font-semibold">
                {profile.city
                  ? `${profile.city}, ${profile.country}`
                  : "Address incomplete"}
              </p>
            </div>
          </div>

          {/* Personal Information Overview */}
          <div className="space-y-4 text-xs font-semibold text-slate-600">
            <h4 className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">
              Contact & Credentials
            </h4>

            {profile.email && (
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-purple-500 shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
            )}

            {profile.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-purple-500 shrink-0" />
                <span>{profile.phone}</span>
              </div>
            )}

            <h4 className="text-[10px] font-bold text-purple-500 uppercase tracking-wider pt-2">
              Academic Overview
            </h4>

            <div className="space-y-2 bg-purple-50/60 p-3.5 rounded-[12px] border border-purple-100">
              <div className="flex items-start gap-2.5">
                <GraduationCap className="h-[18px] w-[18px] text-purple-600 shrink-0 mt-0.5" />

                <div className="space-y-1 text-[11px] font-semibold text-slate-600">
                  <p className="font-bold text-slate-800">
                    {collegeName}
                  </p>

                  {collegeEdu.degree && (
                    <p className="text-[10px] text-slate-500">
                      {collegeEdu.degree} {collegeEdu.branch ? `in ${collegeEdu.branch}` : ""}
                    </p>
                  )}

                  {collegeEdu.college_passing_year && (
                    <p className="text-[10px] text-slate-400">
                      Class of {collegeEdu.college_passing_year}
                    </p>
                  )}

                  {collegeEdu.cgpa && (
                    <span className="inline-block bg-purple-100 text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">
                      CGPA: {collegeEdu.cgpa}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Social Links (Part A1: Clear, branded representation) */}
          <div className="border-t border-purple-100 pt-5 space-y-3">
            <h4 className="text-[10px] font-bold text-purple-500 uppercase tracking-wider">
              Social & Developer Profiles
            </h4>

            <div className="flex flex-wrap gap-2">
              {Object.entries(profile.social_profiles || {}).map(([key, url]) => {
                if (!url) return null;
                const platform = key.toLowerCase();
                let badgeClass = "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200";
                let label = key.charAt(0).toUpperCase() + key.slice(1);

                if (platform.includes("github")) {
                  badgeClass = "bg-slate-900 hover:bg-slate-800 text-white border-slate-900";
                  label = "GitHub";
                } else if (platform.includes("linkedin")) {
                  badgeClass = "bg-blue-600 hover:bg-blue-700 text-white border-blue-600";
                  label = "LinkedIn";
                } else if (platform.includes("leetcode")) {
                  badgeClass = "bg-amber-500 hover:bg-amber-600 text-white border-amber-500";
                  label = "LeetCode";
                } else if (platform.includes("codechef")) {
                  badgeClass = "bg-amber-800 hover:bg-amber-900 text-white border-amber-800";
                  label = "CodeChef";
                }

                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs ${badgeClass}`}
                    title={label}
                  >
                    <span>{label}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                );
              })}

              {(!profile.social_profiles || Object.values(profile.social_profiles).every((v) => !v)) && (
                <p className="text-[11px] text-slate-400 font-medium italic">
                  No social profiles connected.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* About Me */}
          <div className="premium-card p-6 bg-white border border-purple-100 space-y-3">
            <h4 className="font-poppins font-bold text-slate-800 text-sm flex items-center gap-2">
              <FileSpreadsheet className="h-[18px] w-[18px] text-purple-600" />
              About Me
            </h4>

            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {profile.career_objective ||
                "Go to 'About Me' tab to edit your career summary."}
            </p>
          </div>

          {/* Separated Technical & Soft Skills (Part A3) */}
          <div className="premium-card p-6 bg-white border border-purple-100 space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="font-poppins font-bold text-slate-800 text-sm flex items-center gap-2">
                <Code className="h-[18px] w-[18px] text-purple-600" />
                Skills & Competencies
              </h4>
              <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
                {totalSkills} Total
              </span>
            </div>

            {/* Technical Skills Sub-section */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Technical Skills ({technicalSkills.length})
              </span>
              {technicalSkills.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No technical skills added yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {technicalSkills.map((skill, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50/80 border border-purple-100 rounded-full text-xs font-semibold text-slate-700"
                    >
                      {skill.name}
                      <span className="text-[9px] font-bold bg-purple-200 text-purple-800 px-1.5 py-0.2 rounded-full uppercase">
                        {skill.level}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Soft Skills Sub-section */}
            <div className="space-y-2.5 pt-3 border-t border-purple-50">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Soft Skills & Professional Attributes ({softSkills.length})
              </span>
              {softSkills.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No soft skills added yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {softSkills.map((skill, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-800"
                    >
                      {skill.name}
                      <span className="text-[9px] font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded-full uppercase">
                        {skill.level}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Projects */}
          <div className="premium-card p-6 bg-white border border-purple-100 space-y-4">
            <h4 className="font-poppins font-bold text-slate-800 text-sm flex items-center gap-2">
              <FolderGit2 className="h-[18px] w-[18px] text-purple-600" />
              Recent Projects
            </h4>

            {totalProjects === 0 ? (
              <p className="text-xs text-slate-400 font-medium">
                No projects added.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.projects.slice(0, 4).map((proj, i) => (
                  <div
                    key={i}
                    className="p-4 bg-purple-50/50 rounded-[16px] border border-purple-100 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <h5 className="text-xs font-bold text-slate-800">
                        {proj.title}
                      </h5>

                      <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-relaxed">
                        {proj.description}
                      </p>

                      {proj.technologies && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {proj.technologies
                            .split(",")
                            .map((tech, idx) => (
                              <span
                                key={idx}
                                className="text-[9px] font-bold bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full"
                              >
                                {tech.trim()}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold pt-2 border-t border-purple-100">
                      <span>Role: {proj.role}</span>

                      <div className="flex gap-2">
                        {proj.github_link && (
                          <a
                            href={proj.github_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:text-purple-700 hover:underline flex items-center gap-0.5"
                          >
                            GitHub
                          </a>
                        )}

                        {proj.live_link && (
                          <a
                            href={proj.live_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:text-purple-700 hover:underline flex items-center gap-0.5"
                          >
                            Live
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Experience & Certifications */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Experience & Internships */}
            <div className="premium-card p-6 bg-white border border-purple-100 space-y-3">
              <h4 className="font-poppins font-bold text-slate-800 text-sm flex items-center gap-2">
                <Briefcase className="h-[18px] w-[18px] text-purple-600" />
                Experience & Internships
              </h4>

              {totalExperience === 0 && totalInternships === 0 ? (
                <p className="text-xs text-slate-400 font-medium">
                  No experiences or internships listed.
                </p>
              ) : (
                <div className="space-y-3">
                  {(profile.internships || []).slice(0, 2).map((intern, i) => (
                    <div
                      key={`intern-${i}`}
                      className="text-[11px] font-semibold text-slate-600 border-l-2 border-emerald-400 pl-3 py-0.5 space-y-0.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-slate-800">{intern.role || "Intern"}</p>
                        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded-full uppercase">
                          Internship
                        </span>
                      </div>
                      <p className="text-slate-400 text-[10px]">
                        {intern.company}
                      </p>
                      {intern.duration && (
                        <span className="text-[9px] text-slate-400 block">
                          {intern.duration}
                        </span>
                      )}
                    </div>
                  ))}

                  {(profile.experience || []).slice(0, 2).map((exp, i) => (
                    <div
                      key={`exp-${i}`}
                      className="text-[11px] font-semibold text-slate-600 border-l-2 border-purple-300 pl-3 py-0.5 space-y-0.5"
                    >
                      <p className="font-bold text-slate-800">{exp.role}</p>
                      <p className="text-slate-400 text-[10px]">
                        {exp.company}
                      </p>
                      <span className="text-[9px] text-slate-400 block">
                        {exp.joining_date} - {exp.ending_date || "Present"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Certifications */}
            <div className="premium-card p-6 bg-white border border-purple-100 space-y-3">
              <h4 className="font-poppins font-bold text-slate-800 text-sm flex items-center gap-2">
                <Award className="h-[18px] w-[18px] text-purple-600" />
                Certifications
              </h4>

              {totalCertifications === 0 ? (
                <p className="text-xs text-slate-400 font-medium">
                  No certifications listed.
                </p>
              ) : (
                <div className="space-y-3">
                  {profile.certifications.slice(0, 3).map((cert, i) => (
                    <div
                      key={i}
                      className="text-[11px] font-semibold text-slate-600 border-l-2 border-purple-300 pl-3 py-0.5 space-y-0.5"
                    >
                      <p className="font-bold text-slate-800">
                        {cert.certificate_name}
                      </p>

                      <p className="text-slate-400 text-[10px]">
                        {cert.platform}
                      </p>

                      {cert.credential_link && (
                        <a
                          href={cert.credential_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-purple-600 hover:text-purple-700 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                        >
                          View credential
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}