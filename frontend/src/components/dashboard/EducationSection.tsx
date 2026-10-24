import React, { useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  GraduationCap,
  School,
  Building2,
  X,
} from "lucide-react";
import { Profile } from "@/types/profile";

interface EducationSectionProps {
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

type EducationType = "school" | "college";

export default function EducationSection({
  profile,
  addListItem,
  removeListItem,
  updateListItem,
  handleSaveProfile,
  saving,
}: EducationSectionProps) {
  const [showEducationOptions, setShowEducationOptions] = useState(false);

  const addSchool = () => {
    addListItem("education", {
      type: "school",
      school_name: "",
      board: "",
      school_passing_year: "",
      percentage: "",
    });

    setShowEducationOptions(false);
  };

  const addCollege = () => {
    addListItem("education", {
      type: "college",
      college_name: "",
      university: "",
      degree: "",
      branch: "",
      semester: "",
      cgpa: "",
      college_passing_year: "",
    });

    setShowEducationOptions(false);
  };

  return (
    <div className="premium-card p-6 md:p-8 bg-white space-y-6 border border-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-poppins font-bold text-lg text-slate-800">
            Education
          </h2>

          <p className="text-xs text-slate-400 font-medium mt-1">
            Add your school and college/university education separately.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowEducationOptions(true)}
          className="px-5 py-3 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 text-white rounded-[12px] text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Education
        </button>
      </div>

      {/* Education Cards */}
      {profile.education.length > 0 ? (
        <div className="space-y-5">
          {profile.education.map((edu, index) => {
            const educationType: EducationType =
              edu.type === "college" ? "college" : "school";

            if (educationType === "school") {
              return (
                <div
                  key={index}
                  className="relative p-5 md:p-6 bg-purple-50/40 border border-purple-100 rounded-[20px] space-y-5"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-4 border-b border-purple-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[12px] bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                        <School className="h-5 w-5" />
                      </div>

                      <div>
                        <h3 className="font-poppins font-bold text-sm text-slate-800">
                          School Education
                        </h3>

                        <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wider mt-0.5">
                          Secondary Education
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeListItem("education", index)}
                      className="p-2 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-[10px] transition-colors cursor-pointer"
                      title="Delete education"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* School Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                        School Name
                      </label>

                      <input
                        type="text"
                        value={edu.school_name || ""}
                        onChange={(e) =>
                          updateListItem(
                            "education",
                            index,
                            "school_name",
                            e.target.value
                          )
                        }
                        className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                        placeholder="e.g. St. Xavier's School"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                        Board
                      </label>

                      <input
                        type="text"
                        value={edu.board || ""}
                        onChange={(e) =>
                          updateListItem(
                            "education",
                            index,
                            "board",
                            e.target.value
                          )
                        }
                        className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                        placeholder="e.g. CBSE / ICSE / State Board"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                        Passing Year
                      </label>

                      <input
                        type="number"
                        value={edu.school_passing_year || ""}
                        onChange={(e) =>
                          updateListItem(
                            "education",
                            index,
                            "school_passing_year",
                            e.target.value ? Number(e.target.value) : ""
                          )
                        }
                        className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                        placeholder="e.g. 2020"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                        Percentage
                      </label>

                      <input
                        type="text"
                        value={edu.percentage || ""}
                        onChange={(e) =>
                          updateListItem(
                            "education",
                            index,
                            "percentage",
                            e.target.value
                          )
                        }
                        className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                        placeholder="e.g. 92%"
                      />
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={index}
                className="relative p-5 md:p-6 bg-purple-50/40 border border-purple-100 rounded-[20px] space-y-5"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-4 border-b border-purple-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[12px] bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <GraduationCap className="h-5 w-5" />
                    </div>

                    <div>
                      <h3 className="font-poppins font-bold text-sm text-slate-800">
                        College / University
                      </h3>

                      <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wider mt-0.5">
                        Higher Education
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeListItem("education", index)}
                    className="p-2 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-[10px] transition-colors cursor-pointer"
                    title="Delete education"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* College Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                      College Name
                    </label>

                    <input
                      type="text"
                      value={edu.college_name || ""}
                      onChange={(e) =>
                        updateListItem(
                          "education",
                          index,
                          "college_name",
                          e.target.value
                        )
                      }
                      className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                      placeholder="e.g. ABC Institute of Technology"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                      University
                    </label>

                    <input
                      type="text"
                      value={edu.university || ""}
                      onChange={(e) =>
                        updateListItem(
                          "education",
                          index,
                          "university",
                          e.target.value
                        )
                      }
                      className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                      placeholder="e.g. Gujarat Technological University"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                      Degree
                    </label>

                    <input
                      type="text"
                      value={edu.degree || ""}
                      onChange={(e) =>
                        updateListItem(
                          "education",
                          index,
                          "degree",
                          e.target.value
                        )
                      }
                      className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                      placeholder="e.g. B.Tech"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                      Branch / Specialization
                    </label>

                    <input
                      type="text"
                      value={edu.branch || ""}
                      onChange={(e) =>
                        updateListItem(
                          "education",
                          index,
                          "branch",
                          e.target.value
                        )
                      }
                      className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                      placeholder="e.g. Computer Science & Engineering"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                      Current Semester
                    </label>

                    <input
                      type="text"
                      value={edu.semester || ""}
                      onChange={(e) =>
                        updateListItem(
                          "education",
                          index,
                          "semester",
                          e.target.value
                        )
                      }
                      className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                      placeholder="e.g. 8th Semester"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                      CGPA
                    </label>

                    <input
                      type="text"
                      value={edu.cgpa || ""}
                      onChange={(e) =>
                        updateListItem(
                          "education",
                          index,
                          "cgpa",
                          e.target.value
                        )
                      }
                      className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                      placeholder="e.g. 9.15"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1.5">
                      Passing / Graduation Year
                    </label>

                    <input
                      type="number"
                      value={edu.college_passing_year || ""}
                      onChange={(e) =>
                        updateListItem(
                          "education",
                          index,
                          "college_passing_year",
                          e.target.value ? Number(e.target.value) : ""
                        )
                      }
                      className="w-full px-4 py-2.5 bg-white border border-purple-200 rounded-[10px] text-sm text-slate-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                      placeholder="e.g. 2026"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 px-6 rounded-[20px] bg-purple-50/50 border border-dashed border-purple-200 text-center">
          <div className="w-12 h-12 mx-auto rounded-[14px] bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
            <GraduationCap className="h-6 w-6" />
          </div>

          <h3 className="font-poppins font-bold text-sm text-slate-700">
            No Education Added
          </h3>

          <p className="text-xs text-slate-400 mt-1">
            Add your school or college education to build your profile.
          </p>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={() => setShowEducationOptions(true)}
          className="flex-1 py-3.5 bg-purple-50 hover:bg-purple-100 rounded-[12px] text-purple-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors border border-purple-200"
        >
          <Plus className="h-4 w-4" />
          Add Education
        </button>

        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={saving}
          className="px-6 py-3.5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-[12px] flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-lg shadow-purple-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving..." : "Save Education"}
        </button>
      </div>

      {/* Add Education Modal */}
      {showEducationOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowEducationOptions(false)}
          />

          <div className="relative w-full max-w-md bg-white rounded-[24px] shadow-2xl border border-purple-100 p-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="font-poppins font-bold text-lg text-slate-800">
                  Add Education
                </h3>

                <p className="text-xs text-slate-400 mt-1">
                  Select the type of education you want to add.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowEducationOptions(false)}
                className="p-2 rounded-[10px] hover:bg-purple-50 text-slate-500 hover:text-purple-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={addSchool}
                className="group p-5 rounded-[18px] border border-purple-200 bg-purple-50/50 hover:bg-purple-100 hover:border-purple-300 transition-all text-left cursor-pointer"
              >
                <div className="w-12 h-12 rounded-[14px] bg-purple-100 text-purple-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <School className="h-6 w-6" />
                </div>

                <h4 className="font-poppins font-bold text-sm text-slate-800">
                  School
                </h4>

                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Add your school, board, passing year and percentage.
                </p>
              </button>

              <button
                type="button"
                onClick={addCollege}
                className="group p-5 rounded-[18px] border border-purple-200 bg-purple-50/50 hover:bg-purple-100 hover:border-purple-300 transition-all text-left cursor-pointer"
              >
                <div className="w-12 h-12 rounded-[14px] bg-purple-100 text-purple-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Building2 className="h-6 w-6" />
                </div>

                <h4 className="font-poppins font-bold text-sm text-slate-800">
                  College / University
                </h4>

                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Add your degree, branch, university, CGPA and graduation
                  details.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}