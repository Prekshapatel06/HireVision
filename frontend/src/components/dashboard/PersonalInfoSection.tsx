import React from "react";
import { Loader2, Save, Mail } from "lucide-react";
import { Profile } from "@/types/profile";

interface PersonalInfoSectionProps {
  profile: Profile;
  handleInputChange: (field: keyof Profile, value: any) => void;
  handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaveProfile: () => void;
  saving: boolean;
}

export default function PersonalInfoSection({
  profile,
  handleInputChange,
  handlePhotoUpload,
  handleSaveProfile,
  saving,
}: PersonalInfoSectionProps) {
  return (
    <div className="premium-card p-6 md:p-8 bg-white space-y-6 border border-slate-100">
      {/* Profile Photo */}
      <div className="flex flex-col sm:flex-row items-center gap-5 border-b border-purple-100 pb-5">
        {profile.profile_photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.profile_photo}
            alt="Avatar Preview"
            className="w-20 h-20 rounded-full object-cover border-2 border-purple-200 shadow-sm"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-purple-50 flex items-center justify-center font-bold text-purple-500 border-2 border-purple-100">
            Photo
          </div>
        )}

        <div>
          <input
            type="file"
            accept="image/*"
            id="photo-upload"
            onChange={handlePhotoUpload}
            className="hidden"
          />

          <label
            htmlFor="photo-upload"
            className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-[12px] text-xs font-bold text-purple-700 cursor-pointer inline-block transition-colors"
          >
            Upload Avatar Image
          </label>

          <p className="text-[10px] text-slate-400 font-medium mt-1">
            Supports PNG, JPG. Saved locally inside base64 string.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Full Name */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Full Name
          </label>

          <input
            type="text"
            value={profile.full_name}
            onChange={(e) =>
              handleInputChange("full_name", e.target.value)
            }
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-[12px] text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            placeholder="e.g. John Doe"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Email Address
          </label>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

            <input
              type="email"
              value={profile.email || ""}
              readOnly
              disabled
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[12px] text-sm text-slate-600 cursor-not-allowed"
              placeholder="Email address"
            />
          </div>

          <p className="text-[10px] text-slate-400 font-medium mt-1">
            Your registered Google/HireVision email address.
          </p>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Phone Number
          </label>

          <input
            type="text"
            value={profile.phone}
            onChange={(e) =>
              handleInputChange("phone", e.target.value)
            }
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-[12px] text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            placeholder="e.g. +1 555 0199"
          />
        </div>

        {/* Date of Birth */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Date of Birth
          </label>

          <input
            type="date"
            value={profile.dob}
            onChange={(e) =>
              handleInputChange("dob", e.target.value)
            }
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-[12px] text-sm text-slate-800 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
          />
        </div>

        {/* Gender */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Gender
          </label>

          <select
            value={profile.gender}
            onChange={(e) =>
              handleInputChange("gender", e.target.value)
            }
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-[12px] text-sm text-slate-800 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Non-binary">Non-binary</option>
            <option value="Prefer not to say">
              Prefer not to say
            </option>
          </select>
        </div>

        {/* Address */}
        <div className="md:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Address
          </label>

          <input
            type="text"
            value={profile.address}
            onChange={(e) =>
              handleInputChange("address", e.target.value)
            }
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-[12px] text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            placeholder="e.g. 123 Main St"
          />
        </div>

        {/* City */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            City
          </label>

          <input
            type="text"
            value={profile.city}
            onChange={(e) =>
              handleInputChange("city", e.target.value)
            }
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-[12px] text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            placeholder="e.g. San Francisco"
          />
        </div>

        {/* State */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            State
          </label>

          <input
            type="text"
            value={profile.state}
            onChange={(e) =>
              handleInputChange("state", e.target.value)
            }
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-[12px] text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            placeholder="e.g. California"
          />
        </div>

        {/* Country */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Country
          </label>

          <input
            type="text"
            value={profile.country}
            onChange={(e) =>
              handleInputChange("country", e.target.value)
            }
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-[12px] text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            placeholder="e.g. United States"
          />
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSaveProfile}
        disabled={saving}
        className="px-6 py-3.5 bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700 text-white text-xs font-bold rounded-[12px] flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}

        {saving ? "Saving..." : "Save Personal Details"}
      </button>
    </div>
  );
}