import React from "react";
import { Loader2, Save } from "lucide-react";
import { Profile } from "@/types/profile";

interface SocialProfilesSectionProps {
  profile: Profile;
  handleSocialChange: (platform: string, value: string) => void;
  handleSaveProfile: () => void;
  saving: boolean;
}

export default function SocialProfilesSection({
  profile,
  handleSocialChange,
  handleSaveProfile,
  saving,
}: SocialProfilesSectionProps) {
  return (
    <div className="premium-card p-6 md:p-8 bg-white space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            label: "LinkedIn URL",
            key: "linkedin",
            placeholder: "https://linkedin.com/in/...",
          },
          {
            label: "GitHub URL",
            key: "github",
            placeholder: "https://github.com/...",
          },
          {
            label: "Portfolio URL",
            key: "portfolio",
            placeholder: "https://...",
          },
          {
            label: "LeetCode URL",
            key: "leetcode",
            placeholder: "https://leetcode.com/u/...",
          },
          {
            label: "CodeChef URL",
            key: "codechef",
            placeholder: "https://codechef.com/users/...",
          },
          {
            label: "HackerRank URL",
            key: "hackerrank",
            placeholder: "https://hackerrank.com/...",
          },
        ].map((field) => (
          <div key={field.key}>
            <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-2">
              {field.label}
            </label>

            <input
              type="url"
              value={profile.social_profiles[field.key]}
              onChange={(e) =>
                handleSocialChange(field.key, e.target.value)
              }
              className="w-full px-4 py-3 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
              placeholder={field.placeholder}
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSaveProfile}
        disabled={saving}
        className="px-6 py-3.5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-[12px] flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Save Social Links
      </button>
    </div>
  );
}