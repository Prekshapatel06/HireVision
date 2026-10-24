import React from "react";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { Profile } from "@/types/profile";

interface LanguagesSectionProps {
  profile: Profile;
  addListItem: (field: keyof Profile, defaultObj: any) => void;
  removeListItem: (field: keyof Profile, index: number) => void;
  updateListItem: (field: keyof Profile, index: number, key: string, value: any) => void;
  handleSaveProfile: () => void;
  saving: boolean;
}

export default function LanguagesSection({ profile, addListItem, removeListItem, updateListItem, handleSaveProfile, saving }: LanguagesSectionProps) {
  return (
    <div className="premium-card p-6 md:p-8 bg-white space-y-6">
      {profile.languages.map((lang, index) => (
        <div key={index} className="flex gap-4 items-center">
          <input 
            type="text" 
            value={lang.language || ""} 
            onChange={(e) => updateListItem("languages", index, "language", e.target.value)}
            className="w-1/2 px-4 py-3 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            placeholder="e.g. English"
          />
          <select 
            value={lang.proficiency || ""} 
            onChange={(e) => updateListItem("languages", index, "proficiency", e.target.value)}
            className="w-1/2 px-4 py-3 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
          >
            <option value="">Select Proficiency</option>
            <option value="Native / Bilingual">Native / Bilingual</option>
            <option value="Professional / Fluent">Professional / Fluent</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Conversational / Basic">Conversational / Basic</option>
          </select>
          <button onClick={() => removeListItem("languages", index)} className="text-purple-500 hover:text-purple-700 p-2 cursor-pointer">
            <Trash2 className="h-4.5 w-4.5" />
          </button>
        </div>
      ))}

      <div className="flex gap-4">
        <button 
          onClick={() => addListItem("languages", { language: "", proficiency: "" })}
          className="w-full py-3.5 bg-purple-50 hover:bg-purple-100 rounded-[12px] text-purple-600 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors border border-purple-100"
        >
          <Plus className="h-4 w-4" /> Add Language
        </button>
        <button onClick={handleSaveProfile} disabled={saving} className="px-6 py-3.5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-[12px] flex items-center gap-2 cursor-pointer shrink-0 shadow-lg shadow-purple-500/20">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Languages
        </button>
      </div>
    </div>
  );
}