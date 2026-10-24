import React from "react"; 
import { Loader2, Plus, Trash2, Save } from "lucide-react"; 
import { Profile } from "@/types/profile"; 
 
interface AchievementsSectionProps { 
  profile: Profile; 
  handleInputChange: (field: keyof Profile, value: any) => void; 
  handleSaveProfile: () => void; 
  saving: boolean; 
} 
 
export default function AchievementsSection({ profile, handleInputChange, handleSaveProfile, saving }: AchievementsSectionProps) { 
  return ( 
    <div className="premium-card p-6 md:p-8 bg-white space-y-6"> 
      {profile.achievements.map((ach, index) => ( 
        <div key={index} className="flex gap-2 items-center"> 
          <input  
            type="text"  
            value={ach}  
            onChange={(e) => { 
              const newAch = [...profile.achievements]; 
              newAch[index] = e.target.value; 
              handleInputChange("achievements", newAch); 
            }} 
            className="w-full px-4 py-3 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all" 
            placeholder="e.g. Secured 1st Rank in Hackathon 2025" 
          /> 
          <button  
            onClick={() => { 
              const newAch = profile.achievements.filter((_, i) => i !== index); 
              handleInputChange("achievements", newAch); 
            }} 
            className="text-purple-500 hover:text-purple-700 p-2 cursor-pointer" 
          > 
            <Trash2 className="h-4.5 w-4.5" /> 
          </button> 
        </div> 
      ))} 
 
      <div className="flex gap-4"> 
        <button  
          onClick={() => handleInputChange("achievements", [...profile.achievements, ""])} 
          className="w-full py-3.5 bg-purple-50 hover:bg-purple-100 rounded-[12px] text-purple-600 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors border border-purple-100" 
        > 
          <Plus className="h-4 w-4" /> Add Achievement Record 
        </button> 
        <button onClick={handleSaveProfile} disabled={saving} className="px-6 py-3.5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-[12px] flex items-center gap-2 cursor-pointer shrink-0 shadow-lg shadow-purple-500/20"> 
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Achievements 
        </button> 
      </div> 
    </div> 
  ); 
}