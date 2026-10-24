import React from "react";
import { Loader2, FileText } from "lucide-react";
import { Profile } from "@/types/profile";

interface ResumeUploadSectionProps {
  profile: Profile;
  handleResumeFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadingResume: boolean;
}

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export default function ResumeUploadSection({
  profile,
  handleResumeFile,
  uploadingResume,
}: ResumeUploadSectionProps) {
  return (
    <div className="premium-card p-6 md:p-8 bg-white space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-2.5">
            Upload Resume Document (PDF only)
          </label>

          <input
            type="file"
            accept="application/pdf"
            id="pdf-file-upload"
            onChange={handleResumeFile}
            className="hidden"
          />

          <label
            htmlFor="pdf-file-upload"
            className="px-5 py-3 bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded-[12px] text-xs font-bold text-purple-600 cursor-pointer inline-flex items-center gap-2 transition-colors"
          >
            {uploadingResume ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Choose PDF Resume File
          </label>
        </div>

        {profile.resume_url && (
          <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-[12px] flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="truncate max-w-sm">
              Current PDF: {profile.resume_url}
            </span>

            <a
              href={`${API_URL}${profile.resume_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:text-purple-700 hover:underline font-bold"
            >
              Download File
            </a>
          </div>
        )}
      </div>
    </div>
  );
}