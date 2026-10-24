import React from "react";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { Profile } from "@/types/profile";

interface InternshipsSectionProps {
  profile: Profile;
  addListItem: (field: keyof Profile, defaultObj: any) => void;
  removeListItem: (field: keyof Profile, index: number) => void;
  updateListItem: (field: keyof Profile, index: number, key: string, value: any) => void;
  handleSaveProfile: () => void;
  saving: boolean;
}

export default function InternshipsSection({ profile, addListItem, removeListItem, updateListItem, handleSaveProfile, saving }: InternshipsSectionProps) {
  return (
    <div className="premium-card p-6 md:p-8 bg-white space-y-6">
      {profile.internships.map((intern, index) => (
        <div key={index} className="p-5 bg-purple-50/40 rounded-[20px] border border-purple-100 relative space-y-4">
          <button onClick={() => removeListItem("internships", index)} className="absolute top-4 right-4 text-purple-500 hover:text-purple-700 cursor-pointer">
            <Trash2 className="h-4.5 w-4.5" />
          </button>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">Company</label>
              <input 
                type="text" 
                value={intern.company || ""} 
                onChange={(e) => updateListItem("internships", index, "company", e.target.value)}
                className="w-full px-4 py-2 bg-white border border-purple-100 rounded-[10px] text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">Role</label>
              <input 
                type="text" 
                value={intern.role || ""} 
                onChange={(e) => updateListItem("internships", index, "role", e.target.value)}
                className="w-full px-4 py-2 bg-white border border-purple-100 rounded-[10px] text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">Duration</label>
              <input 
                type="text" 
                value={intern.duration || ""} 
                onChange={(e) => updateListItem("internships", index, "duration", e.target.value)}
                className="w-full px-4 py-2 bg-white border border-purple-100 rounded-[10px] text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">Description</label>
              <textarea 
                rows={2} 
                value={intern.description || ""} 
                onChange={(e) => updateListItem("internships", index, "description", e.target.value)}
                className="w-full px-4 py-2 bg-white border border-purple-100 rounded-[10px] text-sm"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex gap-4">
        <button 
          onClick={() => addListItem("internships", { company: "", role: "", duration: "", description: "" })}
          className="w-full py-3.5 bg-purple-50 hover:bg-purple-100 rounded-[12px] text-purple-600 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors border border-purple-100"
        >
          <Plus className="h-4 w-4" /> Add Internship
        </button>
        <button onClick={handleSaveProfile} disabled={saving} className="px-6 py-3.5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-[12px] flex items-center gap-2 cursor-pointer shrink-0 shadow-lg shadow-purple-500/20">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Internships
        </button>
      </div>
    </div>
  );
}