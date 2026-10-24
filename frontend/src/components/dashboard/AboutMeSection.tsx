import React from "react";
import { Loader2, Save } from "lucide-react";
import { Profile } from "@/types/profile";

interface AboutMeSectionProps {
  profile: Profile;
  handleInputChange: (field: keyof Profile, value: any) => void;
  handleSaveProfile: () => void;
  saving: boolean;
}

export default function AboutMeSection({
  profile,
  handleInputChange,
  handleSaveProfile,
  saving,
}: AboutMeSectionProps) {
  return (
    <div className="premium-card p-6 md:p-8 bg-white space-y-6 border border-slate-100">
      <div>
        <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-2.5">
          Professional Summary & Career Objective
        </label>

        <textarea
          rows={6}
          value={profile.career_objective}
          onChange={(e) =>
            handleInputChange("career_objective", e.target.value)
          }
          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-[12px] text-sm text-slate-800 placeholder:text-slate-400 resize-y focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
          placeholder="State your professional career goals, details about yourself, and long-term hiring objectives..."
        />
      </div>

      <button
        type="button"
        onClick={handleSaveProfile}
        disabled={saving}
        className="px-6 py-3.5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-[12px] flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}

        {saving ? "Saving..." : "Save About Me"}
      </button>
    </div>
  );
}