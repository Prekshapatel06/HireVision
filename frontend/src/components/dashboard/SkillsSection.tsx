import React from "react";
import { Loader2, Edit3, Trash2, Save, Plus } from "lucide-react";
import { Profile, Skill } from "@/types/profile";

interface SkillsSectionProps {
  profile: Profile;
  skillForm: Skill;
  setSkillForm: React.Dispatch<React.SetStateAction<Skill>>;
  editingSkillIndex: number | null;
  saveSkill: () => void;
  editSkill: (index: number) => void;
  removeListItem: (field: keyof Profile, index: number) => void;
  cancelSkillEdit: () => void;
  handleSaveProfile: () => void;
  saving: boolean;
}

const skillCategories = [
  "Programming Languages",
  "Frameworks",
  "Libraries",
  "Databases",
  "Developer Tools",
  "Soft Skills",
];

const categoryColors: Record<string, string> = {
  "Programming Languages":
    "bg-purple-50 border-purple-100 text-purple-700",
  Frameworks:
    "bg-violet-50 border-violet-100 text-violet-700",
  Libraries:
    "bg-indigo-50 border-indigo-100 text-indigo-700",
  Databases:
    "bg-purple-50 border-purple-100 text-purple-700",
  "Developer Tools":
    "bg-violet-50 border-violet-100 text-violet-700",
  "Soft Skills":
    "bg-indigo-50 border-indigo-100 text-indigo-700",
};

export default function SkillsSection({
  profile,
  skillForm,
  setSkillForm,
  editingSkillIndex,
  saveSkill,
  editSkill,
  removeListItem,
  cancelSkillEdit,
  handleSaveProfile,
  saving,
}: SkillsSectionProps) {
  const groupedSkills = skillCategories.reduce(
    (groups, category) => {
      groups[category] = profile.skills.filter(
        (skill) => skill.category === category
      );
      return groups;
    },
    {} as Record<string, Skill[]>
  );

  return (
    <div className="premium-card p-6 md:p-8 bg-white space-y-8">

      {/* Add / Edit Skill */}
      <div className="p-5 md:p-6 bg-purple-50/50 rounded-[20px] border border-purple-100 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-[10px] bg-purple-100 text-purple-600 flex items-center justify-center">
            <Plus className="h-4 w-4" />
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-800">
              {editingSkillIndex !== null ? "Edit Skill" : "Add New Skill"}
            </h4>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              Add your technical and professional skills
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Skill Name */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Skill Name
            </label>

            <input
              type="text"
              value={skillForm.name}
              onChange={(e) =>
                setSkillForm((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 transition-all"
              placeholder="e.g. React"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Category
            </label>

            <select
              value={skillForm.category}
              onChange={(e) =>
                setSkillForm((prev) => ({
                  ...prev,
                  category: e.target.value,
                }))
              }
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 transition-all"
            >
              {skillCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Experience Level */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Experience Level
            </label>

            <select
              value={skillForm.level}
              onChange={(e) =>
                setSkillForm((prev) => ({
                  ...prev,
                  level: e.target.value,
                }))
              }
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 transition-all"
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Expert">Expert</option>
            </select>
          </div>
        </div>

        {/* Form Buttons */}
        <div className="flex gap-2.5">
          <button
            onClick={saveSkill}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-[10px] cursor-pointer transition-colors shadow-sm shadow-purple-200"
          >
            {editingSkillIndex !== null ? "Update Skill" : "Add Skill"}
          </button>

          {editingSkillIndex !== null && (
            <button
              onClick={cancelSkillEdit}
              className="px-5 py-2.5 bg-white hover:bg-purple-50 border border-purple-100 text-slate-600 text-xs font-semibold rounded-[10px] cursor-pointer transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Categorized Skills */}
      <div className="space-y-6">

        <div>
          <h4 className="text-sm font-bold text-slate-800">
            My Skills
          </h4>
          <p className="text-[10px] text-slate-400 font-medium mt-1">
            Your skills are automatically organized by category.
          </p>
        </div>

        {profile.skills.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-purple-200 rounded-[16px] bg-purple-50/30">
            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center mx-auto mb-3">
              <Plus className="h-5 w-5" />
            </div>

            <p className="text-xs font-semibold text-slate-500">
              No skills added yet.
            </p>

            <p className="text-[10px] text-slate-400 mt-1">
              Add your first skill using the form above.
            </p>
          </div>
        ) : (
          <div className="space-y-7">

            {skillCategories.map((category) => {
              const skills = groupedSkills[category];

              if (skills.length === 0) {
                return null;
              }

              return (
                <div
                  key={category}
                  className="space-y-3"
                >

                  {/* Category Header */}
                  <div className="flex items-center gap-3">
                    <h5 className="text-xs font-bold text-slate-700">
                      {category}
                    </h5>

                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 text-[9px] font-bold">
                      {skills.length}
                    </span>

                    <div className="flex-1 h-px bg-purple-100" />
                  </div>

                  {/* Skills */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    {profile.skills.map((skill, index) => {
                      if (skill.category !== category) {
                        return null;
                      }

                      return (
                        <div
                          key={`${skill.name}-${index}`}
                          className="group p-4 bg-white border border-purple-100 rounded-[16px] flex items-center justify-between hover:border-purple-200 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">

                            <div
                              className={`w-9 h-9 rounded-[10px] border flex items-center justify-center shrink-0 ${categoryColors[category]}`}
                            >
                              <span className="text-xs font-black">
                                {skill.name
                                  ?.substring(0, 1)
                                  .toUpperCase()}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">
                                {skill.name}
                              </p>

                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] text-slate-400 font-semibold">
                                  {skill.category}
                                </span>

                                <span className="text-slate-300">
                                  •
                                </span>

                                <span className="text-[9px] font-bold text-purple-600">
                                  {skill.level}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1.5 ml-3 shrink-0">
                            <button
                              onClick={() => editSkill(index)}
                              className="p-1.5 text-purple-500 hover:bg-purple-50 hover:text-purple-700 rounded-full cursor-pointer transition-colors"
                              title="Edit skill"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>

                            <button
                              onClick={() =>
                                removeListItem("skills", index)
                              }
                              className="p-1.5 text-purple-400 hover:bg-purple-50 hover:text-purple-600 rounded-full cursor-pointer transition-colors"
                              title="Delete skill"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  </div>
                </div>
              );
            })}

          </div>
        )}
      </div>

      {/* Save */}
      <div className="pt-2 border-t border-purple-100">
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

          Save Skills to DB
        </button>
      </div>
    </div>
  );
}