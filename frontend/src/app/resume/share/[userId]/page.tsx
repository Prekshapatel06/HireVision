"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { 
  Loader2, 
  AlertCircle, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  ExternalLink,
  Download,
  Printer
} from "lucide-react";
import { normalizeApiUrl } from "@/lib/api";

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
import { HireVisionLogo } from "../../../../components/HireVisionLogo";

type TemplateType = "professional" | "ats" | "skills" | "timeline";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default function ResumeSharePage({ params }: PageProps) {
  const { userId } = use(params);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [template, setTemplate] = useState<TemplateType>("professional");

  useEffect(() => {
    if (!userId) return;

    const fetchPublicProfile = async () => {
      try {
        const apiUrl = normalizeApiUrl();
        const res = await fetch(`${apiUrl}/api/profile/public/${userId}`);
        if (!res.ok) {
          throw new Error("Unable to fetch candidate profile details. The user ID may be invalid.");
        }
        const data = await res.json();
        
        // Map skills list
        let parsedSkills = [];
        if (data.skills) {
          if (Array.isArray(data.skills)) {
            parsedSkills = data.skills;
          } else {
            Object.entries(data.skills).forEach(([category, list]) => {
              if (Array.isArray(list)) {
                list.forEach(skillName => {
                  parsedSkills.push({
                    name: skillName,
                    category: category,
                    level: "Intermediate"
                  });
                });
              }
            });
          }
        }

        setProfile({
          ...data,
          skills: parsedSkills,
          education: data.education || [],
          projects: data.projects || [],
          experience: data.experience || [],
          certifications: data.certifications || [],
          social_profiles: data.social_profiles || {}
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicProfile();
  }, [userId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-650 gap-3">
        <Loader2 className="h-9 w-9 animate-spin text-indigo-600" />
        <span className="font-poppins font-bold text-xs">Retrieving Live Resume profile...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-6 text-center">
        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100 mb-4">
          <AlertCircle className="h-5 w-5" />
        </div>
        <h3 className="font-poppins font-black text-xl text-slate-850">Resume Profile Not Found</h3>
        <p className="text-xs text-slate-450 mt-1 font-semibold max-w-sm leading-relaxed">{error || "The profile you requested does not exist or has been disabled."}</p>
        <Link href="/" className="mt-6 px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-md">Back to Home</Link>
      </div>
    );
  }

  const primaryEdu = profile.education?.[0] || null;

  return (
    <div className="min-h-screen bg-slate-50 font-inter py-8 px-4 flex flex-col items-center print:bg-white print:py-0 print:px-0">
      
      {/* Top action bar - controls styles */}
      <div className="w-full max-w-[800px] mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-slate-200/80 p-4.5 rounded-2xl shadow-sm print:hidden">
        
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <HireVisionLogo className="h-7 w-7" />
          <div className="flex flex-col">
            <span className="font-poppins font-bold text-sm bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">HireVision Live</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Public Share Verification</span>
          </div>
        </div>

        {/* Template Selector dropdown */}
        <div className="flex items-center gap-3.5 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 flex-grow sm:flex-grow-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Template:</span>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as TemplateType)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="professional">Professional (Classic)</option>
              <option value="ats">ATS-Optimized (Linear)</option>
              <option value="skills">Skill-Focused (Competency)</option>
              <option value="timeline">Modern Split (Timeline)</option>
            </select>
          </div>

          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-655 cursor-pointer"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>

      </div>

      {/* Main Resume Sheet */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-8 md:p-10 min-h-[1050px] w-full max-w-[800px] font-inter relative print:p-0 print:border-none print:shadow-none print:rounded-none">
        
        {/* 1. PROFESSIONAL TEMPLATE */}
        {template === "professional" && (
          <div className="space-y-7">
            {/* Header */}
            <div className="text-center pb-6 border-b-2 border-slate-100 space-y-2">
              <h1 className="font-poppins font-extrabold text-3xl text-slate-900 leading-tight">
                {profile.full_name || profile.username || "Candidate"}
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
                <h3 className="font-poppins font-extrabold text-sm text-purple-900 uppercase tracking-wider border-b-2 border-purple-100 pb-2 mb-3.5">Career Objective</h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">{profile.career_objective}</p>
              </div>
            )}

            {/* Skills */}
            {profile.skills && profile.skills.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-poppins font-extrabold text-sm text-purple-900 uppercase tracking-wider border-b-2 border-purple-100 pb-2 mb-3.5">Technical Competencies</h3>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {profile.skills.map((s, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-semibold text-slate-650 flex items-center gap-1.5">
                      {s.name} <span className="text-[9px] font-bold bg-slate-200 text-slate-500 px-1.5 py-0.2 rounded uppercase">{s.level}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {profile.experience && profile.experience.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-poppins font-extrabold text-sm text-purple-900 uppercase tracking-wider border-b-2 border-purple-100 pb-2 mb-3.5">Employment Chronology</h3>
                <div className="space-y-4">
                  {profile.experience.map((exp, idx) => (
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

            {/* Projects */}
            {profile.projects && profile.projects.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-poppins font-extrabold text-sm text-purple-900 uppercase tracking-wider border-b-2 border-purple-100 pb-2 mb-3.5">Key Engineering Projects</h3>
                <div className="space-y-4">
                  {profile.projects.map((proj, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-800 text-xs">{proj.title}</h4>
                          <span className="text-[10px] text-purple-650 font-bold">Role: {proj.role} {proj.duration ? `(${proj.duration})` : ""}</span>
                        </div>
                        <div className="flex gap-2.5 text-[10px] font-bold">
                          {proj.github_link && <a href={proj.github_link} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-850">Repo</a>}
                          {proj.live_link && <a href={proj.live_link} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-850">Live</a>}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{proj.description}</p>
                      {proj.technologies && (
                        <p className="text-[10px] text-slate-450 font-bold">Stack used: {proj.technologies}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {primaryEdu && (
              <div className="space-y-3">
                <h3 className="font-poppins font-extrabold text-sm text-purple-900 uppercase tracking-wider border-b-2 border-purple-100 pb-2 mb-3.5">Education</h3>
                <div className="flex justify-between items-start text-xs font-semibold text-slate-650 leading-relaxed">
                  <div>
                    <p className="font-bold text-slate-800">{primaryEdu.college_name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{primaryEdu.university}</p>
                    <p className="text-[10px] text-slate-500">{primaryEdu.degree} in {primaryEdu.branch}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold">{primaryEdu.college_passing_year}</span>
                    {primaryEdu.cgpa && <p className="text-[10px] text-purple-650 font-bold mt-1">CGPA: {primaryEdu.cgpa}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. ATS-OPTIMIZED TEMPLATE */}
        {template === "ats" && (
          <div className="space-y-6 font-mono text-slate-950 text-xs">
            <div className="text-left border-b border-slate-900 pb-4 space-y-1">
              <h1 className="font-black text-2xl tracking-tight uppercase">{profile.full_name || profile.username || "CANDIDATE"}</h1>
              <p className="font-bold text-[11px] uppercase tracking-wider">
                {profile.email} | {profile.phone} | {profile.city ? `${profile.city}, ${profile.country}` : "Address"}
              </p>
              {profile.social_profiles?.github && <p className="font-bold text-[10px]">Github: {profile.social_profiles.github}</p>}
              {profile.social_profiles?.linkedin && <p className="font-bold text-[10px]">LinkedIn: {profile.social_profiles.linkedin}</p>}
            </div>

            {profile.career_objective && (
              <div className="space-y-1.5">
                <h3 className="font-black text-[11px] uppercase tracking-wider border-b border-slate-300 pb-0.5">Summary</h3>
                <p className="leading-relaxed text-slate-700 font-medium">{profile.career_objective}</p>
              </div>
            )}

            {profile.skills && profile.skills.length > 0 && (
              <div className="space-y-1.5">
                <h3 className="font-black text-[11px] uppercase tracking-wider border-b border-slate-300 pb-0.5">Skills</h3>
                <p className="leading-relaxed text-slate-800 font-medium font-mono">
                  {profile.skills.map(s => `${s.name} (${s.level})`).join(", ")}
                </p>
              </div>
            )}

            {profile.experience && profile.experience.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-black text-[11px] uppercase tracking-wider border-b border-slate-300 pb-0.5">Experience</h3>
                <div className="space-y-3">
                  {profile.experience.map((exp, idx) => (
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

            {profile.projects && profile.projects.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-black text-[11px] uppercase tracking-wider border-b border-slate-300 pb-0.5">Projects</h3>
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

            {primaryEdu && (
              <div className="space-y-2">
                <h3 className="font-black text-[11px] uppercase tracking-wider border-b border-slate-300 pb-0.5">Education</h3>
                <div className="flex justify-between font-bold text-slate-800">
                  <span>{primaryEdu.college_name.toUpperCase()} - {primaryEdu.degree.toUpperCase()}</span>
                  <span>{primaryEdu.college_passing_year}</span>
                </div>
                <p className="text-slate-700 font-semibold font-mono">CGPA: {primaryEdu.cgpa}</p>
              </div>
            )}
          </div>
        )}

        {/* 3. SKILL-FOCUSED TEMPLATE */}
        {template === "skills" && (
          <div className="space-y-6 text-xs text-slate-850">
            <div className="border-b-4 border-slate-800 pb-4 flex justify-between items-end">
              <div>
                <h1 className="font-poppins font-black text-2xl text-slate-800 uppercase tracking-tight">{profile.full_name || profile.username || "Candidate"}</h1>
                <p className="text-purple-650 font-bold font-poppins mt-0.5">Professional Resume Profile</p>
              </div>
              <div className="text-right text-[10px] font-bold text-slate-500 space-y-0.5">
                <p>{profile.email}</p>
                <p>{profile.phone}</p>
                <p>{profile.city}</p>
              </div>
            </div>

            {profile.skills && profile.skills.length > 0 && (
              <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <h3 className="font-poppins font-extrabold text-xs text-slate-800 uppercase tracking-wider block">Core Competencies & Capabilities</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {profile.skills.map((s, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200/50 flex flex-col">
                      <span className="font-bold text-slate-850 text-xs">{s.name}</span>
                      <span className="text-[9px] font-bold text-purple-600 mt-1 uppercase tracking-wide">{s.level} Level</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profile.projects && profile.projects.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-poppins font-extrabold text-xs text-slate-800 uppercase tracking-wider block">Functional Projects & Scope</h3>
                <div className="space-y-3">
                  {profile.projects.map((proj, idx) => (
                    <div key={idx} className="border border-slate-200/80 p-3.5 rounded-xl space-y-1.5">
                      <h4 className="font-bold text-slate-850 text-xs">{proj.title} <span className="text-[10px] text-slate-400 font-semibold">({proj.role})</span></h4>
                      <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{proj.description}</p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {proj.technologies.split(',').map((tech, i) => (
                          <span key={i} className="text-[9px] font-bold bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{tech.trim()}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profile.experience && profile.experience.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-poppins font-extrabold text-xs text-slate-800 uppercase tracking-wider block">Professional Chronology</h3>
                <div className="space-y-2">
                  {profile.experience.map((exp, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs font-semibold text-slate-600">
                      <span>{exp.role} at <span className="font-bold text-slate-800">{exp.company}</span></span>
                      <span className="text-[10px] text-slate-400 font-bold">{exp.joining_date} - {exp.ending_date || "Present"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {primaryEdu && (
              <div className="border-t border-slate-200 pt-4 text-xs font-semibold text-slate-650">
                <p>Degree: <span className="font-bold text-slate-800">{primaryEdu.degree} in {primaryEdu.branch}</span> ({primaryEdu.college_passing_year})</p>
                <p className="text-[10px] text-slate-400 font-bold">{primaryEdu.college_name}</p>
              </div>
            )}
          </div>
        )}

        {/* 4. EXPERIENCE-TIMELINE TEMPLATE */}
        {template === "timeline" && (
          <div className="flex flex-col md:grid md:grid-cols-12 gap-8 text-xs text-slate-750">
            
            {/* Left Column (4 cols) */}
            <div className="md:col-span-4 bg-slate-900 text-slate-350 p-5 rounded-2xl space-y-6 flex flex-col justify-between">
              
              <div className="space-y-6">
                <div className="text-center">
                  {profile.profile_photo ? (
                    <img 
                      src={profile.profile_photo} 
                      alt="Avatar" 
                      className="w-20 h-20 rounded-full object-cover border-2 border-slate-800 mx-auto" 
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-800 text-purple-400 flex items-center justify-center font-bold text-lg mx-auto">
                      {profile.full_name?.substring(0, 2).toUpperCase() || (profile.username ? profile.username.substring(0, 2).toUpperCase() : "HV")}
                    </div>
                  )}
                  <h2 className="font-poppins font-black text-sm text-white mt-3 truncate">{profile.full_name || profile.username || "Candidate"}</h2>
                  <p className="text-[9px] font-bold text-purple-400 uppercase tracking-wider block mt-0.5 truncate">Candidate</p>
                </div>

                <div className="space-y-3 border-t border-slate-800 pt-4.5 text-[10px]">
                  <h3 className="font-bold text-white uppercase tracking-wider text-[9px]">Contact Info</h3>
                  {profile.email && <p className="truncate">Email: {profile.email}</p>}
                  {profile.phone && <p>Phone: {profile.phone}</p>}
                  {profile.city && <p>Location: {profile.city}, {profile.country}</p>}
                </div>

                {profile.skills && profile.skills.length > 0 && (
                  <div className="space-y-2.5 border-t border-slate-800 pt-4.5">
                    <h3 className="font-bold text-white uppercase tracking-wider text-[9px]">Skills</h3>
                    <div className="flex flex-wrap gap-1">
                      {profile.skills.map((s, idx) => (
                        <span key={idx} className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-[9px] font-semibold border border-slate-700">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {primaryEdu && (
                <div className="border-t border-slate-800 pt-4 text-[9.5px]">
                  <h3 className="font-bold text-white uppercase tracking-wider text-[9px] mb-1.5">Education</h3>
                  <p className="font-bold text-slate-200">{primaryEdu.degree}</p>
                  <p className="text-slate-400">{primaryEdu.college_name}</p>
                  <p className="text-purple-400 font-bold mt-1">Passing: {primaryEdu.college_passing_year}</p>
                </div>
              )}

            </div>

            {/* Right Column (8 cols) */}
            <div className="md:col-span-8 space-y-6">
              
              {profile.career_objective && (
                <div className="space-y-2">
                  <h3 className="font-poppins font-black text-purple-900 uppercase tracking-wider border-b-2 border-purple-100 pb-2 mb-3.5">Career Objective</h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{profile.career_objective}</p>
                </div>
              )}

              {profile.experience && profile.experience.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-poppins font-black text-purple-900 uppercase tracking-wider border-b-2 border-purple-100 pb-2 mb-3.5">Employment Timeline</h3>
                  <div className="space-y-4 relative border-l border-slate-200 pl-4.5 ml-1">
                    {profile.experience.map((exp, idx) => (
                      <div key={idx} className="relative space-y-1">
                        <span className="absolute -left-6 top-1 w-2.5 h-2.5 bg-purple-600 rounded-full border-2 border-white ring-4 ring-purple-50" />
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-800 text-xs">{exp.role}</h4>
                            <span className="text-[10px] text-slate-400 font-bold">{exp.company}</span>
                          </div>
                          <span className="text-[9.5px] text-purple-650 font-bold">{exp.joining_date} - {exp.ending_date || "Present"}</span>
                        </div>
                        {exp.description && <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{exp.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profile.projects && profile.projects.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-poppins font-black text-purple-900 uppercase tracking-wider border-b-2 border-purple-100 pb-2 mb-3.5">Engineering Projects</h3>
                  <div className="space-y-3.5">
                    {profile.projects.map((proj, idx) => (
                      <div key={idx} className="space-y-1">
                        <h4 className="font-bold text-slate-850 text-xs">{proj.title} <span className="text-[9px] text-slate-400 font-bold">({proj.role})</span></h4>
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
  );
}
