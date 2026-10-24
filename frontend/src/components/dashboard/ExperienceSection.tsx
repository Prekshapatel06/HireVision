import React from "react";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { Profile } from "@/types/profile";

interface ExperienceSectionProps {
  profile: Profile;
  addListItem: (field: keyof Profile, defaultObj: any) => void;
  removeListItem: (field: keyof Profile, index: number) => void;
  updateListItem: (field: keyof Profile, index: number, key: string, value: any) => void;
  handleSaveProfile: () => void;
  saving: boolean;
}

export default function ExperienceSection({ profile, addListItem, removeListItem, updateListItem, handleSaveProfile, saving }: ExperienceSectionProps) {
  return (
    <div className="premium-card p-6 md:p-8 bg-white space-y-6">
      {profile.experience.map((exp, index) => (
        <div key={index} className="p-5 bg-purple-50/40 rounded-[20px] border border-purple-100 relative space-y-4">
          <button onClick={() => removeListItem("experience", index)} className="absolute top-4 right-4 text-purple-500 hover:text-purple-700 cursor-pointer">
            <Trash2 className="h-4.5 w-4.5" />
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">Company</label>
              <input 
                type="text" 
                value={exp.company || ""} 
                onChange={(e) => updateListItem("experience", index, "company", e.target.value)}
                className="w-full px-4 py-2 bg-white border border-purple-100 rounded-[10px] text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">Role</label>
              <input 
                type="text" 
                value={exp.role || ""} 
                onChange={(e) => updateListItem("experience", index, "role", e.target.value)}
                className="w-full px-4 py-2 bg-white border border-purple-100 rounded-[10px] text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">Joining Date</label>
              <input 
                type="date" 
                value={exp.joining_date || ""} 
                onChange={(e) => updateListItem("experience", index, "joining_date", e.target.value)}
                className="w-full px-4 py-2 bg-white border border-purple-100 rounded-[10px] text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">Ending Date</label>
              <input 
                type="date" 
                value={exp.ending_date || ""} 
                onChange={(e) => updateListItem("experience", index, "ending_date", e.target.value)}
                className="w-full px-4 py-2 bg-white border border-purple-100 rounded-[10px] text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">Description</label>
              <textarea 
                rows={3} 
                value={exp.description || ""} 
                onChange={(e) => updateListItem("experience", index, "description", e.target.value)}
                className="w-full px-4 py-2 bg-white border border-purple-100 rounded-[10px] text-sm"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex gap-4">
        <button 
          onClick={() => addListItem("experience", { company: "", role: "", joining_date: "", ending_date: "", description: "" })}
          className="w-full py-3.5 bg-purple-50 hover:bg-purple-100 rounded-[12px] text-purple-600 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors border border-purple-100"
        >
          <Plus className="h-4 w-4" /> Add Experience History
        </button>
        <button onClick={handleSaveProfile} disabled={saving} className="px-6 py-3.5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-[12px] flex items-center gap-2 cursor-pointer shrink-0 shadow-lg shadow-purple-500/20">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Experience
        </button>
      </div>
    </div>
  );
}