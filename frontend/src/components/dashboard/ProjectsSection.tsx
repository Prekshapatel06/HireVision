import React from "react";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { Profile } from "@/types/profile";

interface ProjectsSectionProps {
  profile: Profile;
  addListItem: (field: keyof Profile, defaultObj: any) => void;
  removeListItem: (field: keyof Profile, index: number) => void;
  updateListItem: (
    field: keyof Profile,
    index: number,
    key: string,
    value: any
  ) => void;
  handleSaveProfile: () => void;
  saving: boolean;
}

export default function ProjectsSection({
  profile,
  addListItem,
  removeListItem,
  updateListItem,
  handleSaveProfile,
  saving,
}: ProjectsSectionProps) {
  return (
    <div className="premium-card p-6 md:p-8 bg-white space-y-6">
      {profile.projects.map((proj, index) => (
        <div
          key={index}
          className="p-5 bg-purple-50/40 rounded-[20px] border border-purple-100 relative space-y-4"
        >
          <button
            type="button"
            onClick={() => removeListItem("projects", index)}
            className="absolute top-4 right-4 text-purple-500 hover:text-purple-700 cursor-pointer transition-colors"
            aria-label="Delete project"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 border-b border-purple-100 pb-3 pr-8">
            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
              <span className="text-xs font-bold">{index + 1}</span>
            </div>

            <h4 className="text-xs font-bold text-purple-600 uppercase tracking-wider">
              Project {index + 1}
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                Project Title
              </label>

              <input
                type="text"
                value={proj.title || ""}
                onChange={(e) =>
                  updateListItem(
                    "projects",
                    index,
                    "title",
                    e.target.value
                  )
                }
                className="w-full px-4 py-2.5 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                placeholder="e.g. HireVision Platform"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                Description
              </label>

              <textarea
                rows={3}
                value={proj.description || ""}
                onChange={(e) =>
                  updateListItem(
                    "projects",
                    index,
                    "description",
                    e.target.value
                  )
                }
                className="w-full px-4 py-2.5 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all resize-none"
                placeholder="Summarize your project, features, responsibilities and achievements..."
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                Technologies Used
              </label>

              <input
                type="text"
                value={proj.technologies || ""}
                onChange={(e) =>
                  updateListItem(
                    "projects",
                    index,
                    "technologies",
                    e.target.value
                  )
                }
                className="w-full px-4 py-2.5 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                placeholder="e.g. React, TypeScript, PostgreSQL"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                Your Role
              </label>

              <input
                type="text"
                value={proj.role || ""}
                onChange={(e) =>
                  updateListItem(
                    "projects",
                    index,
                    "role",
                    e.target.value
                  )
                }
                className="w-full px-4 py-2.5 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                placeholder="e.g. Full Stack Developer"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                GitHub Repository Link
              </label>

              <input
                type="url"
                value={proj.github_link || ""}
                onChange={(e) =>
                  updateListItem(
                    "projects",
                    index,
                    "github_link",
                    e.target.value
                  )
                }
                className="w-full px-4 py-2.5 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                placeholder="https://github.com/..."
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                Production Live Link
              </label>

              <input
                type="url"
                value={proj.live_link || ""}
                onChange={(e) =>
                  updateListItem(
                    "projects",
                    index,
                    "live_link",
                    e.target.value
                  )
                }
                className="w-full px-4 py-2.5 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                placeholder="https://..."
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                Duration
              </label>

              <input
                type="text"
                value={proj.duration || ""}
                onChange={(e) =>
                  updateListItem(
                    "projects",
                    index,
                    "duration",
                    e.target.value
                  )
                }
                className="w-full px-4 py-2.5 bg-white border border-purple-100 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                placeholder="e.g. Jan 2026 - Mar 2026"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={() =>
            addListItem("projects", {
              title: "",
              description: "",
              technologies: "",
              role: "",
              github_link: "",
              live_link: "",
              duration: "",
            })
          }
          className="flex-1 py-3.5 bg-purple-50 hover:bg-purple-100 rounded-[12px] text-purple-600 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors border border-purple-100"
        >
          <Plus className="h-4 w-4" />
          Add Project
        </button>

        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={saving}
          className="px-6 py-3.5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-[12px] flex items-center justify-center gap-2 cursor-pointer shrink-0 transition-colors shadow-lg shadow-purple-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Projects
        </button>
      </div>
    </div>
  );
}