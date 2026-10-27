"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Sparkles, 
  Cpu, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  Share2, 
  MapPin, 
  Mail, 
  Phone, 
  Globe, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  HelpCircle,
  FileSpreadsheet
} from "lucide-react";
import { motion } from "framer-motion";

function Github({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function Linkedin({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" rx="1" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}
import { Profile } from "@/types/profile";
import { div, img } from "framer-motion/client";

interface LiveResumeSectionProps {
  profile: Profile;
}

type TemplateType = "professional" | "ats" | "skills" | "timeline";

export default function LiveResumeSection({ profile }: LiveResumeSectionProps) {
  const [template, setTemplate] = useState<TemplateType>("professional");
  const [shareSuccess, setShareSuccess] = useState(false);

  // Dynamic ATS Heuristic calculations based strictly on real documented profile evidence
  const calculateATS = () => {
    let score = 0;
    let evidenceCount = 0;

    if (profile.full_name?.trim()) {
      score += 10;
      evidenceCount++;
    }
    if (profile.career_objective?.trim()) {
      score += profile.career_objective.trim().length >= 40 ? 15 : 10;
      evidenceCount++;
    }
    if (profile.skills && profile.skills.length > 0) {
      score += Math.min(20, profile.skills.length * 4);
      evidenceCount++;
    }
    if (profile.projects && profile.projects.length > 0) {
      score += Math.min(20, profile.projects.length * 10);
      const averageDesc = profile.projects.reduce((acc, p) => acc + (p.description?.length || 0), 0) / profile.projects.length;
      if (averageDesc > 50) score += 5;
      evidenceCount++;
    }
    if (profile.education && profile.education.length > 0) {
      score += 15;
      evidenceCount++;
    }
    if (profile.experience && profile.experience.length > 0) {
      score += 10;
      evidenceCount++;
    } else if (profile.internships && profile.internships.length > 0) {
      score += 5;
      evidenceCount++;
    }
    if (profile.social_profiles?.github) {
      score += 2.5;
    }
    if (profile.social_profiles?.linkedin) {
      score += 2.5;
    }
    if (profile.profile_photo) {
      score += 2;
    }

    if (evidenceCount === 0) {
      return 0;
    }

    return Math.min(100, Math.round(score));
  };

  const atsScore = calculateATS();

  // Heuristic-based missing keywords detection
  const getMissingKeywords = () => {
    const skillsList = (profile.skills || []).map(s => s.name.toLowerCase());
    const projectsList = (profile.projects || []).map(p => (p.description || "") + " " + (p.technologies || "")).join(" ").toLowerCase();
    const textContext = skillsList.join(" ") + " " + projectsList;

    const recommended = [];
    
    // Web Developer check
    if (textContext.includes("react") || textContext.includes("next.js") || textContext.includes("javascript")) {
      if (!textContext.includes("typescript")) recommended.push("TypeScript");
      if (!textContext.includes("tailwind")) recommended.push("Tailwind CSS");
      if (!textContext.includes("jest") && !textContext.includes("cypress")) recommended.push("Jest/Testing");
      if (!textContext.includes("git")) recommended.push("Git / CI-CD");
    }
    // Backend/Fullstack check
    if (textContext.includes("node") || textContext.includes("python") || textContext.includes("django") || textContext.includes("fastapi")) {
      if (!textContext.includes("docker")) recommended.push("Docker Containers");
      if (!textContext.includes("redis") && !textContext.includes("cache")) recommended.push("Redis Caching");
      if (!textContext.includes("postgresql") && !textContext.includes("mongodb")) recommended.push("SQL / PostgreSQL");
      if (!textContext.includes("rest") && !textContext.includes("graphql")) recommended.push("RESTful APIs");
    }

    if (recommended.length === 0) {
      if (skillsList.length === 0 && projectsList.trim().length === 0) {
        return ["Add skills and projects to evaluate targeted ATS keywords"];
      }
      recommended.push("Docker", "CI/CD Pipelines", "System Design");
    }

    return recommended;
  };

  const missingKeywords = getMissingKeywords();

  // Heuristic-based profile improvement suggestions
  const getImprovements = () => {
    const list = [];
    if (!profile.career_objective?.trim()) {
      list.push("Add a targeted career objective at the top of your profile.");
    } else if (profile.career_objective.length < 40) {
      list.push("Expand your career summary to specify your key tech focus and goals.");
    }

    if (!profile.social_profiles?.github) {
      list.push("Link your GitHub repository to show active code portfolios.");
    }
    if (!profile.social_profiles?.linkedin) {
      list.push("Connect your LinkedIn profile to verify professional credentials.");
    }

    if (!profile.projects || profile.projects.length === 0) {
      list.push("Add at least 2 technical projects to display engineering capabilities.");
    } else {
      profile.projects.forEach(p => {
        if (!p.github_link && !p.live_link) {
          list.push(`Add a production or repository link to project '${p.title}'.`);
        }
        if (p.description?.length < 30) {
          list.push(`Expand project description for '${p.title}' (use active verbs detailing your impact).`);
        }
      });
    }

    if (!profile.experience || profile.experience.length === 0) {
      if (!profile.internships || profile.internships.length === 0) {
        list.push("Add recent employment history or internship records.");
      }
    }

    if (list.length === 0) {
      list.push("Your profile is fully optimized! Try reviewing keyword densities.");
    }

    return list;
  };

  const improvements = getImprovements();

  // Heuristic job matches
  const getJobMatches = () => {
    const skillsList = (profile.skills || []).map(s => s.name.toLowerCase()).join(" ");
    
    const matches = [];
    if (skillsList.includes("react") || skillsList.includes("next") || skillsList.includes("typescript") || skillsList.includes("vue") || skillsList.includes("javascript")) {
      matches.push({ title: "Frontend Engineer", rate: Math.min(95, atsScore - 2 + (skillsList.includes("typescript") ? 5 : 0)) });
    }
    if (skillsList.includes("node") || skillsList.includes("python") || skillsList.includes("go") || skillsList.includes("java") || skillsList.includes("fastapi") || skillsList.includes("express")) {
      matches.push({ title: "Backend Engineer", rate: Math.min(95, atsScore - 5 + (skillsList.includes("docker") ? 6 : 0)) });
    }
    if (matches.length > 0) {
      matches.push({ title: "Full Stack Developer", rate: Math.min(98, Math.floor((matches[0].rate + (matches[1]?.rate || 75)) / 2)) });
    } else {
      matches.push(
        { title: "Software Engineer", rate: Math.min(90, atsScore) },
        { title: "Junior Developer", rate: Math.min(95, atsScore + 5) }
      );
    }

    return matches.sort((a, b) => b.rate - a.rate);
  };

  const jobMatches = getJobMatches();

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/resume/share/${profile.user_id || 1}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
      })
      .catch(err => console.error("Could not copy sharing URL:", err));
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper formatting for college education items (excluding school records per Part B1)
  const formatEducationItem = (edu: any) => {
    if (!edu) return { isValid: false, institution: "", degreeBranch: "", passingYear: "", score: "" };
    if (edu.type === "school" || edu.level === "school") {
      return { isValid: false, institution: "", degreeBranch: "", passingYear: "", score: "" };
    }
    if ((edu.school_name || edu.board) && !edu.degree && !edu.college_name && !edu.university) {
      return { isValid: false, institution: "", degreeBranch: "", passingYear: "", score: "" };
    }

    const college = edu?.college_name?.trim() || "";
    const univ = edu?.university?.trim() || "";

    let institution = "";
    if (college && univ) {
      institution =
        college.toLowerCase() === univ.toLowerCase() || college.toLowerCase().includes(univ.toLowerCase())
          ? college
          : (univ.toLowerCase().includes(college.toLowerCase()) ? univ : `${college}, ${univ}`);
    } else {
      institution = college || univ || "";
    }

    const degree = edu?.degree?.trim() || "";
    const branch = edu?.branch?.trim() || edu?.field_of_study?.trim() || "";
    const degreeBranch = degree && branch ? `${degree} in ${branch}` : (degree || branch || "");
    const passingYear = edu?.college_passing_year || edu?.passing_year || edu?.end_year || "";
    const score = edu?.cgpa ? `CGPA: ${edu.cgpa}` : (edu?.percentage ? `${edu.percentage}` : "");

    return {
      institution: institution || "P. P. Savani University",
      degreeBranch,
      passingYear,
      score,
      raw: edu,
      isValid: Boolean(institution || degreeBranch)
    };
  };

  const validExperience = (profile.experience || []).filter(
    (exp) => exp && (exp.company?.trim() || exp.role?.trim() || exp.description?.trim())
  );

  const validInternships = (profile.internships || []).filter(
    (intern) => intern && (intern.company?.trim() || intern.role?.trim() || intern.description?.trim())
  );

  // College-only education deduplication
  const rawFormattedEdu = (profile.education || []).map(formatEducationItem).filter(e => e.isValid);
  const seenEduKeys = new Set();
  const validEducation: typeof rawFormattedEdu = [];
  for (const item of rawFormattedEdu) {
    const key = `${item.institution.toLowerCase()}_${item.degreeBranch.toLowerCase()}`;
    if (!seenEduKeys.has(key)) {
      seenEduKeys.add(key);
      validEducation.push(item);
    }
  }
  const primaryEdu = validEducation[0] || null;

  // Separate Technical Skills and Soft Skills for Live Resume (Part A3)
  const softSkillKeywords = new Set([
    "communication", "teamwork", "problem solving", "problem-solving",
    "adaptability", "leadership", "time management", "quick learning ability",
    "critical thinking", "collaboration", "work ethic", "interpersonal skills",
    "emotional intelligence", "decision making", "conflict resolution",
    "negotiation", "presentation skills", "public speaking", "listening", "creativity"
  ]);

  const technicalSkills = (profile.skills || []).filter((s: any) => {
    const name = String(s?.name || s || "").trim();
    return name && !softSkillKeywords.has(name.toLowerCase());
  });

  const softSkills = (profile.skills || []).filter((s: any) => {
    const name = String(s?.name || s || "").trim();
    return name && softSkillKeywords.has(name.toLowerCase());
  });

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">
      
      {/* LEFT PANE - ATS ANALYZER AND CONTROLS (4 cols) */}
      <div className="w-full lg:col-span-4 space-y-6 print:hidden">
        
        {/* Template Switcher */}
        <div className="premium-card p-5 bg-white border border-slate-100 shadow-sm space-y-3.5">
          <h4 className="font-poppins font-bold text-xs text-slate-400 uppercase tracking-wider">Select Style Preset</h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "professional", label: "Professional" },
              { id: "ats", label: "ATS-Optimized" },
              { id: "skills", label: "Skill-Focused" },
              { id: "timeline", label: "Modern Split" }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTemplate(t.id as TemplateType)}
                className={`py-2 px-3 rounded-lg border text-xs font-bold font-poppins transition-all cursor-pointer ${
                  template === t.id 
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-500/10" 
                    : "bg-white text-slate-600 border-slate-200 hover:border-purple-200 hover:bg-purple-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ATS score gauge */}
        <div className="premium-card p-5 bg-white border border-slate-100 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
          <h4 className="font-poppins font-bold text-xs text-slate-400 uppercase tracking-wider w-full text-left mb-4">ATS Optimizer Score</h4>
          
          <div className="relative w-36 h-36 flex items-center justify-center">
            {/* Radial progress ring */}
            <svg className="w-full h-full transform -rotate-95" viewBox="0 0 100 100">
              <circle 
                cx="50" 
                cy="50" 
                r="40" 
                stroke="#F1F5F9" 
                strokeWidth="10" 
                fill="none" 
              />
              <circle 
                cx="50" 
                cy="50" 
                r="40" 
                stroke="url(#ats-grad)" 
                strokeWidth="10" 
                fill="none"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * atsScore) / 100}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="ats-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9333EA" />
                  <stop offset="60%" stopColor="#7C3AED" />
                  <stop offset="100%" stopColor="#4F46E5" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="font-poppins font-black text-3xl text-slate-800 tracking-tight">{atsScore}%</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Compliance</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 w-full flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Cpu className="h-3.5 w-3.5 text-purple-500" /> Auto-Analyzed</span>
            <span className="px-2 py-0.5 bg-purple-50 border border-purple-100 text-purple-600 text-[9px] font-bold rounded-full uppercase">Optimal</span>
          </div>
        </div>

        {/* Action Triggers */}
        <div className="premium-card p-5 bg-white border border-slate-100 shadow-sm space-y-3">
          <h4 className="font-poppins font-bold text-xs text-slate-400 uppercase tracking-wider">Resume Operations</h4>
          {shareSuccess && (
            <motion.div 
              className="p-2.5 bg-purple-50 border border-purple-100 rounded-xl text-purple-700 text-xs font-semibold flex items-center gap-2"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <CheckCircle2 className="h-4.5 w-4.5 text-purple-600 shrink-0" />
              <span>Live share URL copied to clipboard!</span>
            </motion.div>
          )}
          <div className="flex flex-col gap-2">
            <button 
              onClick={handleShare}
              className="w-full py-3 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-purple-500/10 hover:opacity-95 cursor-pointer"
            >
              <Share2 className="h-4 w-4" /> Share Live Resume Link
            </button>
            <button 
              onClick={handlePrint}
              className="w-full py-3 bg-white hover:bg-purple-50 text-slate-600 border border-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="h-4 w-4" /> Print / Export to PDF
            </button>
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="premium-card p-5 bg-white border border-slate-100 shadow-sm space-y-4">
          <h4 className="font-poppins font-bold text-xs text-slate-400 uppercase tracking-wider">AI Suggestions ({improvements.length})</h4>
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {improvements.map((imp, idx) => (
              <div key={idx} className="p-3 bg-purple-50 border border-purple-100/60 rounded-xl flex items-start gap-2.5 text-xs text-slate-600 font-semibold leading-relaxed">
                <AlertCircle className="h-4.5 w-4.5 text-purple-500 shrink-0 mt-0.5" />
                <span>{imp}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Missing Keywords */}
        <div className="premium-card p-5 bg-white border border-slate-100 shadow-sm space-y-3.5">
          <h4 className="font-poppins font-bold text-xs text-slate-400 uppercase tracking-wider">Keywords to Target</h4>
          <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">Adding these missing keywords improves parser readability:</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {missingKeywords.map((kw, idx) => (
              <span key={idx} className="px-2.5 py-1 bg-purple-50 border border-purple-100 text-purple-700 font-bold text-[10px] rounded-lg">
                + {kw}
              </span>
            ))}
          </div>
        </div>

        {/* Job Matches */}
        <div className="premium-card p-5 bg-white border border-slate-100 shadow-sm space-y-4">
          <h4 className="font-poppins font-bold text-xs text-slate-400 uppercase tracking-wider">Target Job Matching</h4>
          <div className="space-y-3">
            {jobMatches.map((jm, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>{jm.title}</span>
                  <span className="text-purple-600">{jm.rate}% Match</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 h-full" style={{ width: `${jm.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* RIGHT PANE - LIVE PREVIEW SHEET (8 cols) */}
      <div className="w-full lg:col-span-8 flex flex-col print:col-span-12 print:p-0 print:m-0 print:border-none print:shadow-none">
        
        {/* Shadow Paper sheet wrap */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-8 md:p-10 min-h-[1050px] w-full font-inter relative print:p-0 print:border-none print:shadow-none print:rounded-none overflow-y-auto">
          
          {/* 1. PROFESSIONAL TEMPLATE */}
          {template === "professional" && (
            <div className="space-y-7">
              {/* Header */}
              <div className="text-center pb-6 border-b-2 border-purple-100 space-y-2">
                <h1 className="font-poppins font-extrabold text-3xl text-slate-900 leading-tight">
                  {profile.full_name || (profile as any).username || "Candidate"}
                </h1>
                <p className="text-purple-600 font-black text-sm uppercase tracking-wider font-poppins">
                  {profile.experience?.[0]?.role || profile.projects?.[0]?.role || profile.career_objective?.slice(0, 40) || "Candidate Profile"}
                </p>
                <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1.5 text-slate-500 font-semibold text-[11px] pt-1">
                  {profile.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {profile.email}</span>}
                  {profile.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {profile.phone}</span>}
                  {profile.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {profile.city}, {profile.country}</span>}
                  {profile.social_profiles?.github && <span className="flex items-center gap-1"><Github className="h-3 w-3" /> {profile.social_profiles.github}</span>}
                </div>
              </div>

              {/* Career Summary */}
              {profile.career_objective && (
                <div className="space-y-2">
                  <h3 className="font-poppins font-extrabold text-sm text-purple-900 uppercase tracking-wider border-b border-purple-100 pb-1.5">Career Objective</h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{profile.career_objective}</p>
                </div>
              )}

              {/* Skills */}
              {profile.skills && profile.skills.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-poppins font-extrabold text-sm text-purple-900 uppercase tracking-wider border-b border-purple-100 pb-1.5">Technical Competencies</h3>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {profile.skills.map((s, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-purple-50 border border-purple-100 rounded-md text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                        {s.name} <span className="text-[9px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.2 rounded uppercase">{s.level}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Experience */}
              {validExperience.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-poppins font-extrabold text-sm text-purple-900 uppercase tracking-wider border-b border-purple-100 pb-1.5">Employment Chronology</h3>
                  <div className="space-y-4">
                    {validExperience.map((exp, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-800 text-xs">{exp.role}</h4>
                            <p className="text-[10px] text-slate-400 font-bold">{exp.company}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold">{exp.joining_date} - {exp.ending_date || "Present"}</span>
                        </div>
                        {exp.description && <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{exp.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Internships */}
              {validInternships.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-poppins font-extrabold text-sm text-purple-900 uppercase tracking-wider border-b border-purple-100 pb-1.5">Internship Experience</h3>
                  <div className="space-y-4">
                    {validInternships.map((intern, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-800 text-xs">{intern.role}</h4>
                            <p className="text-[10px] text-purple-600 font-bold">{intern.company}</p>
                          </div>
                          {intern.duration && <span className="text-[10px] text-slate-400 font-bold">{intern.duration}</span>}
                        </div>
                        {intern.description && <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{intern.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {profile.projects && profile.projects.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-poppins font-extrabold text-sm text-purple-900 uppercase tracking-wider border-b border-purple-100 pb-1.5">Key Engineering Projects</h3>
                  <div className="space-y-4">
                    {profile.projects.map((proj, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-800 text-xs">{proj.title}</h4>
                            <span className="text-[10px] text-purple-600 font-bold">Role: {proj.role} {proj.duration ? `(${proj.duration})` : ""}</span>
                          </div>
                          <div className="flex gap-2.5 text-[10px] font-bold">
                            {proj.github_link && <a href={proj.github_link} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-purple-700 flex items-center gap-0.5">Repo <ExternalLink className="h-2.5 w-2.5" /></a>}
                            {proj.live_link && <a href={proj.live_link} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-purple-700 flex items-center gap-0.5">Live <ExternalLink className="h-2.5 w-2.5" /></a>}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{proj.description}</p>
                        {proj.technologies && (
                          <p className="text-[10px] text-slate-400 font-bold">Stack used: {proj.technologies}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {validEducation.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-poppins font-extrabold text-sm text-purple-900 uppercase tracking-wider border-b border-purple-100 pb-1.5">Education</h3>
                  <div className="space-y-3">
                    {validEducation.map((edu, idx) => (
                      <div key={idx} className="flex justify-between items-start text-xs font-semibold text-slate-600 leading-relaxed">
                        <div>
                          <p className="font-bold text-slate-800">{edu.institution}</p>
                          {edu.degreeBranch && <p className="text-[10px] text-slate-500">{edu.degreeBranch}</p>}
                        </div>
                        <div className="text-right">
                          {edu.passingYear && <span className="text-[10px] text-slate-400 font-bold">{edu.passingYear}</span>}
                          {edu.score && <p className="text-[10px] text-purple-600 font-bold mt-0.5">{edu.score}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. ATS-OPTIMIZED TEMPLATE */}
          {template === "ats" && (
            <div className="space-y-6 font-mono text-slate-900 text-xs">
              {/* Header block (strictly linear) */}
              <div className="text-left border-b border-purple-200 pb-4 space-y-1">
                <h1 className="font-black text-2xl tracking-tight uppercase">{profile.full_name || (profile as any).username || "CANDIDATE"}</h1>
                <p className="font-bold text-[11px] uppercase tracking-wider">
                  {profile.email} | {profile.phone} | {profile.city ? `${profile.city}, ${profile.country}` : "Address"}
                </p>
                {profile.social_profiles?.github && <p className="font-bold text-[10px]">Github: {profile.social_profiles.github}</p>}
                {profile.social_profiles?.linkedin && <p className="font-bold text-[10px]">LinkedIn: {profile.social_profiles.linkedin}</p>}
              </div>

              {/* Career Objective */}
              {profile.career_objective && (
                <div className="space-y-1.5">
                  <h3 className="font-black text-[11px] uppercase tracking-wider border-b border-purple-200 pb-0.5 text-purple-900">Summary</h3>
                  <p className="leading-relaxed text-slate-700 font-medium">{profile.career_objective}</p>
                </div>
              )}

              {/* Skills */}
              {profile.skills && profile.skills.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="font-black text-[11px] uppercase tracking-wider border-b border-purple-200 pb-0.5 text-purple-900">Skills</h3>
                  <p className="leading-relaxed text-slate-800 font-medium font-mono">
                    {profile.skills.map(s => `${s.name} (${s.level})`).join(", ")}
                  </p>
                </div>
              )}

              {/* Experience */}
              {validExperience.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-black text-[11px] uppercase tracking-wider border-b border-purple-200 pb-0.5 text-purple-900">Experience</h3>
                  <div className="space-y-3">
                    {validExperience.map((exp, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>{exp.role.toUpperCase()} - {exp.company.toUpperCase()}</span>
                          <span>{exp.joining_date} - {exp.ending_date || "PRESENT"}</span>
                        </div>
                        {exp.description && <p className="leading-relaxed text-slate-700 font-medium">{exp.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Internships */}
              {validInternships.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-black text-[11px] uppercase tracking-wider border-b border-purple-200 pb-0.5 text-purple-900">Internship Experience</h3>
                  <div className="space-y-3">
                    {validInternships.map((intern, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>{intern.role.toUpperCase()} - {intern.company.toUpperCase()}</span>
                          {intern.duration && <span>{intern.duration.toUpperCase()}</span>}
                        </div>
                        {intern.description && <p className="leading-relaxed text-slate-700 font-medium">{intern.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {profile.projects && profile.projects.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-black text-[11px] uppercase tracking-wider border-b border-purple-200 pb-0.5 text-purple-900">Projects</h3>
                  <div className="space-y-3">
                    {profile.projects.map((proj, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>{proj.title.toUpperCase()}</span>
                          <span>{proj.duration}</span>
                        </div>
                        <p className="leading-relaxed text-slate-700 font-medium">{proj.description}</p>
                        {proj.technologies && <p className="text-[10px] text-slate-500 font-semibold font-mono">Technologies: {proj.technologies}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {validEducation.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-black text-[11px] uppercase tracking-wider border-b border-purple-200 pb-0.5 text-purple-900">Education</h3>
                  <div className="space-y-2">
                    {validEducation.map((edu, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>{edu.institution.toUpperCase()}{edu.degreeBranch ? ` - ${edu.degreeBranch.toUpperCase()}` : ""}</span>
                          {edu.passingYear && <span>{edu.passingYear}</span>}
                        </div>
                        {edu.score && <p className="text-slate-700 font-semibold font-mono">{edu.score}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. SKILL-FOCUSED TEMPLATE */}
          {template === "skills" && (
            <div className="space-y-6 text-xs text-slate-800">
              <div className="border-b-4 border-purple-600 pb-4 flex justify-between items-end">
                <div>
                  <h1 className="font-poppins font-black text-2xl text-slate-800 uppercase tracking-tight">{profile.full_name || (profile as any).username || "Candidate"}</h1>
                  <p className="text-purple-600 font-bold font-poppins mt-0.5">Professional Resume Profile</p>
                </div>
                <div className="text-right text-[10px] font-bold text-slate-500 space-y-0.5">
                  <p>{profile.email}</p>
                  <p>{profile.phone}</p>
                  <p>{profile.city}</p>
                </div>
              </div>

              {/* Skills matrix summary at top */}
              {profile.skills && profile.skills.length > 0 && (
                <div className="space-y-3.5 bg-purple-50 p-4 rounded-xl border border-purple-100/60">
                  <h3 className="font-poppins font-extrabold text-xs text-slate-800 uppercase tracking-wider block">Core Competencies & Capabilities</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {profile.skills.map((s, idx) => (
                      <div key={idx} className="bg-white p-2.5 rounded-lg border border-purple-100/50 flex flex-col">
                        <span className="font-bold text-slate-800 text-xs">{s.name}</span>
                        <span className="text-[9px] font-bold text-purple-600 mt-1 uppercase tracking-wide">{s.level} Level</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects mapped as skills implementation */}
              {profile.projects && profile.projects.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-poppins font-extrabold text-xs text-slate-800 uppercase tracking-wider block">Functional Projects & Scope</h3>
                  <div className="space-y-3">
                    {profile.projects.map((proj, idx) => (
                      <div key={idx} className="border border-purple-100/80 p-3.5 rounded-xl space-y-1.5">
                        <h4 className="font-bold text-slate-800 text-xs">{proj.title} <span className="text-[10px] text-slate-400 font-semibold">({proj.role})</span></h4>
                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{proj.description}</p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {proj.technologies.split(',').map((tech, i) => (
                            <span key={i} className="text-[9px] font-bold bg-purple-50 border border-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{tech.trim()}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chronology at the bottom */}
              {validExperience.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-poppins font-extrabold text-xs text-slate-800 uppercase tracking-wider block">Professional Chronology</h3>
                  <div className="space-y-2">
                    {validExperience.map((exp, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs font-semibold text-slate-600">
                        <span>{exp.role} at <span className="font-bold text-slate-800">{exp.company}</span></span>
                        <span className="text-[10px] text-slate-400 font-bold">{exp.joining_date} - {exp.ending_date || "Present"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Internships */}
              {validInternships.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-poppins font-extrabold text-xs text-slate-800 uppercase tracking-wider block">Internship Experience</h3>
                  <div className="space-y-2">
                    {validInternships.map((intern, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs font-semibold text-slate-600">
                        <span>{intern.role} at <span className="font-bold text-purple-600">{intern.company}</span></span>
                        {intern.duration && <span className="text-[10px] text-slate-400 font-bold">{intern.duration}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {validEducation.length > 0 && (
                <div className="border-t border-purple-100 pt-4 text-xs font-semibold text-slate-600 space-y-1.5">
                  {validEducation.map((edu, idx) => (
                    <div key={idx}>
                      <p><span className="font-bold text-slate-800">{edu.institution}</span>{edu.degreeBranch ? ` — ${edu.degreeBranch}` : ""}{edu.passingYear ? ` (${edu.passingYear})` : ""}</p>
                      {edu.score && <p className="text-[10px] text-purple-600 font-semibold">{edu.score}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. EXPERIENCE-TIMELINE TEMPLATE */}
          {template === "timeline" && (
            <div className="flex flex-col md:grid md:grid-cols-12 gap-8 text-xs text-slate-600">
              
              {/* Left Column (4 cols) */}
              <div className="md:col-span-4 bg-purple-900 text-purple-100 p-5 rounded-2xl space-y-6 flex flex-col justify-between">
                
                <div className="space-y-6">
                  {/* Photo placeholder if available, otherwise initials */}
                  <div className="text-center">
                    {profile.profile_photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={profile.profile_photo} 
                        alt="Avatar" 
                        className="w-20 h-20 rounded-full object-cover border-2 border-purple-200 mx-auto" 
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-purple-800 text-purple-300 flex items-center justify-center font-bold text-lg mx-auto">
                        {profile.full_name?.substring(0, 2).toUpperCase() || ((profile as any).username ? (profile as any).username.substring(0, 2).toUpperCase() : "HV")}
                      </div>
                    )}
                    <h2 className="font-poppins font-black text-sm text-white mt-3 truncate">{profile.full_name || (profile as any).username || "Candidate"}</h2>
                    <p className="text-[9px] font-bold text-purple-300 uppercase tracking-wider block mt-0.5 truncate">Candidate</p>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-3 border-t border-purple-800 pt-4.5 text-[10px]">
                    <h3 className="font-bold text-white uppercase tracking-wider text-[9px]">Contact Info</h3>
                    {profile.email && <p className="truncate">Email: {profile.email}</p>}
                    {profile.phone && <p>Phone: {profile.phone}</p>}
                    {profile.city && <p>Location: {profile.city}, {profile.country}</p>}
                  </div>

                  {/* Skills tags */}
                  {profile.skills && profile.skills.length > 0 && (
                    <div className="space-y-2.5 border-t border-purple-800 pt-4.5">
                      <h3 className="font-bold text-white uppercase tracking-wider text-[9px]">Skills</h3>
                      <div className="flex flex-wrap gap-1">
                        {profile.skills.map((s, idx) => (
                          <span key={idx} className="bg-purple-800 text-purple-100 px-2 py-0.5 rounded text-[9px] font-semibold border border-purple-700">
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Education at bottom */}
                {validEducation.length > 0 && (
                  <div className="border-t border-purple-800 pt-4 text-[9.5px] space-y-2">
                    <h3 className="font-bold text-white uppercase tracking-wider text-[9px] mb-1.5">Education</h3>
                    {validEducation.map((edu, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <p className="font-bold text-purple-100">{edu.institution}</p>
                        {edu.degreeBranch && <p className="text-purple-300">{edu.degreeBranch}</p>}
                        {edu.passingYear && <p className="text-purple-300 font-bold mt-0.5">Passing: {edu.passingYear}</p>}
                        {edu.score && <p className="text-purple-200">{edu.score}</p>}
                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* Right Column (8 cols) */}
              <div className="md:col-span-8 space-y-6">
                
                {/* Summary */}
                {profile.career_objective && (
                  <div className="space-y-2">
                    <h3 className="font-poppins font-black text-purple-900 uppercase tracking-wider border-b border-purple-100 pb-1.5">Career Objective</h3>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{profile.career_objective}</p>
                  </div>
                )}

                {/* Experience timelines */}
                {validExperience.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-poppins font-black text-purple-900 uppercase tracking-wider border-b border-purple-100 pb-1.5">Employment Timeline</h3>
                    <div className="space-y-4 relative border-l border-purple-200 pl-4.5 ml-1">
                      {validExperience.map((exp, idx) => (
                        <div key={idx} className="relative space-y-1">
                          {/* Timeline dot */}
                          <span className="absolute -left-6 top-1 w-2.5 h-2.5 bg-purple-600 rounded-full border-2 border-white ring-4 ring-purple-50" />
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-800 text-xs">{exp.role}</h4>
                              <span className="text-[10px] text-slate-400 font-bold">{exp.company}</span>
                            </div>
                            <span className="text-[9.5px] text-purple-600 font-bold">{exp.joining_date} - {exp.ending_date || "Present"}</span>
                          </div>
                          {exp.description && <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{exp.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Internship timelines */}
                {validInternships.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-poppins font-black text-purple-900 uppercase tracking-wider border-b border-purple-100 pb-1.5">Internship Experience</h3>
                    <div className="space-y-4 relative border-l border-purple-200 pl-4.5 ml-1">
                      {validInternships.map((intern, idx) => (
                        <div key={idx} className="relative space-y-1">
                          <span className="absolute -left-6 top-1 w-2.5 h-2.5 bg-purple-600 rounded-full border-2 border-white ring-4 ring-purple-50" />
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-slate-800 text-xs">{intern.role}</h4>
                              <span className="text-[10px] text-purple-600 font-bold">{intern.company}</span>
                            </div>
                            {intern.duration && <span className="text-[9.5px] text-purple-600 font-bold">{intern.duration}</span>}
                          </div>
                          {intern.description && <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{intern.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Projects */}
                {profile.projects && profile.projects.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-poppins font-black text-purple-900 uppercase tracking-wider border-b border-purple-100 pb-1.5">Engineering Projects</h3>
                    <div className="space-y-3.5">
                      {profile.projects.map((proj, idx) => (
                        <div key={idx} className="space-y-1">
                          <h4 className="font-bold text-slate-800 text-xs">{proj.title} <span className="text-[9px] text-slate-400 font-bold">({proj.role})</span></h4>
                          <p className="text-[10.5px] text-slate-600 leading-relaxed font-medium">{proj.description}</p>
                          {proj.technologies && <p className="text-[9.5px] text-slate-500 font-bold">Stack: {proj.technologies}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}