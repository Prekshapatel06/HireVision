"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { motion } from "framer-motion";

import {
  Profile,
  Skill,
} from "@/types/profile";

import OverviewSection from "../../components/dashboard/OverviewSection";
import PersonalInfoSection from "../../components/dashboard/PersonalInfoSection";
import AboutMeSection from "../../components/dashboard/AboutMeSection";
import EducationSection from "../../components/dashboard/EducationSection";
import SkillsSection from "../../components/dashboard/SkillsSection";
import ProjectsSection from "../../components/dashboard/ProjectsSection";
import InternshipsSection from "../../components/dashboard/InternshipsSection";
import ExperienceSection from "../../components/dashboard/ExperienceSection";
import CertificationsSection from "../../components/dashboard/CertificationsSection";
import AchievementsSection from "../../components/dashboard/AchievementsSection";
import LanguagesSection from "../../components/dashboard/LanguagesSection";
import SocialProfilesSection from "../../components/dashboard/SocialProfilesSection";
import ResumeUploadSection from "../../components/dashboard/ResumeUploadSection";
import SettingsSection from "../../components/dashboard/SettingsSection";
import LiveResumeSection from "../../components/dashboard/LiveResumeSection";
import AICareerInsights from "../../components/dashboard/AICareerInsights";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

const emptyProfile: Profile = {
  full_name: "",
  email: "",
  phone: "",
  dob: "",
  gender: "",
  address: "",
  city: "",
  state: "",
  country: "",
  profile_photo: "",
  career_objective: "",
  education: [],
  skills: [],
  projects: [],
  internships: [],
  experience: [],
  certifications: [],
  achievements: [],
  languages: [],
  social_profiles: {
    linkedin: "",
    github: "",
    portfolio: "",
    leetcode: "",
    codechef: "",
    hackerrank: "",
  },
  resume_url: "",
};

const AUTH_TOKEN_KEYS = [
  "token",
  "hirevision_token",
];

const AUTH_USER_KEYS = [
  "user",
  "hirevision_user",
];

const AUTH_ROLE_KEYS = [
  "role",
  "hirevision_role",
];

const normalizeStoredToken = (
  value: string | null
): string | null => {
  if (!value) {
    return null;
  }

  let token = value.trim();

  if (!token) {
    return null;
  }

  try {
    const parsed = JSON.parse(token);

    if (typeof parsed === "string") {
      token = parsed.trim();
    } else if (
      parsed &&
      typeof parsed === "object"
    ) {
      const objectValue =
        parsed as Record<string, unknown>;

      const nestedToken =
        objectValue.token ??
        objectValue.accessToken ??
        objectValue.access_token;

      if (typeof nestedToken === "string") {
        token = nestedToken.trim();
      }
    }
  } catch {
    token = token.trim();
  }

  if (!token) {
    return null;
  }

  if (
    token.startsWith("Bearer ") ||
    token.startsWith("bearer ")
  ) {
    token = token.substring(7).trim();
  }

  return token || null;
};

const buildAuthorizationHeader = (
  token: string
): string => {
  const normalized =
    normalizeStoredToken(token);

  return normalized
    ? `Bearer ${normalized}`
    : "";
};

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab =
    searchParams.get("tab") || "overview";

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [success, setSuccess] =
    useState(false);

  const [error, setError] =
    useState("");

  const [uploadingResume, setUploadingResume] =
    useState(false);

  const [profile, setProfile] =
    useState<Profile>(emptyProfile);

  const [editingSkillIndex, setEditingSkillIndex] =
    useState<number | null>(null);

  const [skillForm, setSkillForm] =
    useState<Skill>({
      name: "",
      category: "Programming Languages",
      level: "Intermediate",
    });

  const getToken = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const storages: Storage[] = [
      sessionStorage,
      localStorage,
    ];

    for (const storage of storages) {
      for (const key of AUTH_TOKEN_KEYS) {
        const token = normalizeStoredToken(
          storage.getItem(key)
        );

        if (token) {
          return token;
        }
      }
    }

    return null;
  }, []);

  const synchronizeAuthToken = useCallback(
    (token: string) => {
      if (
        typeof window === "undefined" ||
        !token
      ) {
        return;
      }

      const normalized =
        normalizeStoredToken(token);

      if (!normalized) {
        return;
      }

      const currentLocalToken =
        normalizeStoredToken(
          localStorage.getItem("token")
        );

      const currentLocalHireVisionToken =
        normalizeStoredToken(
          localStorage.getItem(
            "hirevision_token"
          )
        );

      const currentSessionToken =
        normalizeStoredToken(
          sessionStorage.getItem("token")
        );

      const currentSessionHireVisionToken =
        normalizeStoredToken(
          sessionStorage.getItem(
            "hirevision_token"
          )
        );

      if (
        currentLocalToken !== normalized &&
        !currentSessionToken &&
        !currentSessionHireVisionToken
      ) {
        localStorage.setItem(
          "token",
          normalized
        );
      }

      if (
        currentLocalHireVisionToken !==
          normalized &&
        !currentSessionToken &&
        !currentSessionHireVisionToken
      ) {
        localStorage.setItem(
          "hirevision_token",
          normalized
        );
      }

      if (
        currentSessionToken !== normalized &&
        currentSessionHireVisionToken !==
          normalized &&
        !currentLocalToken &&
        !currentLocalHireVisionToken
      ) {
        sessionStorage.setItem(
          "token",
          normalized
        );

        sessionStorage.setItem(
          "hirevision_token",
          normalized
        );
      }
    },
    []
  );

  const clearAuthStorage = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const keys = [
      ...AUTH_TOKEN_KEYS,
      ...AUTH_USER_KEYS,
      ...AUTH_ROLE_KEYS,
      "hirevision_remember",
    ];

    keys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }, []);

  const redirectToLogin = useCallback(() => {
    clearAuthStorage();
    router.replace("/login?role=candidate");
  }, [
    clearAuthStorage,
    router,
  ]);

  const parseSkills = useCallback(
    (skillsData: unknown): Skill[] => {
      if (!skillsData) {
        return [];
      }

      if (Array.isArray(skillsData)) {
        return skillsData
          .map((skill: unknown) => {
            if (typeof skill === "string") {
              return {
                name: skill,
                category:
                  "Programming Languages",
                level: "Intermediate",
              };
            }

            if (
              skill &&
              typeof skill === "object"
            ) {
              const value =
                skill as Record<
                  string,
                  unknown
                >;

              return {
                name:
                  typeof value.name ===
                  "string"
                    ? value.name
                    : "",
                category:
                  typeof value.category ===
                  "string"
                    ? value.category
                    : "Programming Languages",
                level:
                  typeof value.level ===
                  "string"
                    ? value.level
                    : "Intermediate",
              };
            }

            return {
              name: "",
              category:
                "Programming Languages",
              level: "Intermediate",
            };
          })
          .filter(
            (skill) =>
              skill.name.trim().length > 0
          );
      }

      const parsed: Skill[] = [];

      if (
        typeof skillsData === "object" &&
        skillsData !== null
      ) {
        Object.entries(
          skillsData as Record<
            string,
            unknown
          >
        ).forEach(
          ([category, list]) => {
            if (!Array.isArray(list)) {
              return;
            }

            list.forEach(
              (skillName) => {
                if (
                  typeof skillName !==
                  "string"
                ) {
                  return;
                }

                const formattedCategory =
                  category
                    .replace(/_/g, " ")
                    .replace(
                      /\b\w/g,
                      (char) =>
                        char.toUpperCase()
                    );

                parsed.push({
                  name: skillName,
                  category:
                    formattedCategory ||
                    "Programming Languages",
                  level:
                    "Intermediate",
                });
              }
            );
          }
        );
      }

      return parsed;
    },
    []
  );

  const normalizeProfile = useCallback(
    (data: any): Profile => {
      return {
        full_name:
          data?.full_name || "",

        email:
          data?.email || "",

        phone:
          data?.phone || "",

        dob: data?.dob
          ? String(
              data.dob
            ).substring(0, 10)
          : "",

        gender:
          data?.gender || "",

        address:
          data?.address || "",

        city:
          data?.city || "",

        state:
          data?.state || "",

        country:
          data?.country || "",

        profile_photo:
          data?.profile_photo || "",

        career_objective:
          data?.career_objective || "",

        education:
          Array.isArray(
            data?.education
          )
            ? data.education
            : [],

        skills:
          parseSkills(
            data?.skills
          ),

        projects:
          Array.isArray(
            data?.projects
          )
            ? data.projects
            : [],

        internships:
          Array.isArray(
            data?.internships
          )
            ? data.internships
            : [],

        experience:
          Array.isArray(
            data?.experience
          )
            ? data.experience
            : [],

        certifications:
          Array.isArray(
            data?.certifications
          )
            ? data.certifications
            : [],

        achievements:
          Array.isArray(
            data?.achievements
          )
            ? data.achievements
            : [],

        languages:
          Array.isArray(
            data?.languages
          )
            ? data.languages
            : [],

        social_profiles: {
          linkedin:
            data?.social_profiles
              ?.linkedin || "",

          github:
            data?.social_profiles
              ?.github || "",

          portfolio:
            data?.social_profiles
              ?.portfolio || "",

          leetcode:
            data?.social_profiles
              ?.leetcode || "",

          codechef:
            data?.social_profiles
              ?.codechef || "",

          hackerrank:
            data?.social_profiles
              ?.hackerrank || "",
        },

        resume_url:
          data?.resume_url || "",
      };
    },
    [parseSkills]
  );

  const loadProfile = useCallback(
    async () => {
      const token = getToken();

      if (!token) {
        redirectToLogin();
        return;
      }

      synchronizeAuthToken(token);

      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_URL}/api/profile`,
          {
            method: "GET",
            headers: {
              Accept:
                "application/json",
              Authorization:
                buildAuthorizationHeader(
                  token
                ),
            },
            cache: "no-store",
          }
        );

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          redirectToLogin();
          return;
        }

        let data: any = null;

        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              data?.message ||
              "Failed to load profile details."
          );
        }

        const profileData =
          data?.data &&
          typeof data.data === "object"
            ? data.data
            : data?.profile &&
              typeof data.profile ===
                "object"
            ? data.profile
            : data;

        setProfile(
          normalizeProfile(
            profileData
          )
        );
      } catch (err) {
        console.error(
          "PROFILE LOAD ERROR:",
          err
        );

        if (
          err instanceof TypeError
        ) {
          setError(
            `Unable to connect to the backend. Make sure the backend is running at ${API_URL}.`
          );
        } else if (
          err instanceof Error
        ) {
          setError(err.message);
        } else {
          setError(
            "Error loading profile details."
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [
      getToken,
      normalizeProfile,
      redirectToLogin,
      synchronizeAuthToken,
    ]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (
      typeof window === "undefined"
    ) {
      return;
    }

    const handleStorageChange = () => {
      const token = getToken();

      if (token) {
        synchronizeAuthToken(token);
      }
    };

    window.addEventListener(
      "storage",
      handleStorageChange
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorageChange
      );
    };
  }, [
    getToken,
    synchronizeAuthToken,
  ]);

  const handleInputChange = (
    field: keyof Profile,
    value: any
  ) => {
    setProfile((previous) => ({
      ...previous,
      [field]: value,
    }));

    setSuccess(false);
    setError("");
  };

  const handleSocialChange = (
    platform: string,
    value: string
  ) => {
    setProfile((previous) => ({
      ...previous,
      social_profiles: {
        ...previous.social_profiles,
        [platform]: value,
      },
    }));

    setSuccess(false);
    setError("");
  };

  const handleSaveProfile = async () => {
    const token = getToken();

    if (!token) {
      redirectToLogin();
      return;
    }

    synchronizeAuthToken(token);

    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch(
        `${API_URL}/api/profile`,
        {
          method: "PUT",
          headers: {
            Accept:
              "application/json",
            "Content-Type":
              "application/json",
            Authorization:
              buildAuthorizationHeader(
                token
              ),
          },
          body: JSON.stringify(profile),
        }
      );

      let data: any = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Failed to update profile details."
        );
      }

      setSuccess(true);

      // Trigger fresh real-data AI analysis in background for updated profile metrics
      fetch(`${API_URL}/api/ai/analyze`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: buildAuthorizationHeader(token),
        },
      }).catch((aiErr) => {
        console.warn("Background AI analysis refresh error:", aiErr);
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      setTimeout(() => {
        setSuccess(false);
      }, 4000);
    } catch (err) {
      console.error(
        "PROFILE SAVE ERROR:",
        err
      );

      if (
        err instanceof TypeError
      ) {
        setError(
          "Unable to connect to the backend."
        );
      } else if (
        err instanceof Error
      ) {
        setError(err.message);
      } else {
        setError(
          "Failed to save profile."
        );
      }

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } finally {
      setSaving(false);
    }
  };

  const countSkills = () => {
    return profile.skills?.length || 0;
  };

  const calculateCompletion = () => {
    let score = 0;

    if (profile.full_name) {
      score += 10;
    }

    if (profile.phone) {
      score += 5;
    }

    if (profile.profile_photo) {
      score += 5;
    }

    if (
      profile.career_objective?.trim()
    ) {
      score += 10;
    }

    if (
      profile.skills &&
      profile.skills.length > 0
    ) {
      score += 20;
    }

    if (
      profile.education &&
      profile.education.length > 0
    ) {
      score += 15;
    }

    if (
      profile.projects &&
      profile.projects.length > 0
    ) {
      score += 15;
    }

    if (
      (profile.experience &&
        profile.experience.length > 0) ||
      (profile.internships &&
        profile.internships.length > 0)
    ) {
      score += 10;
    }

    if (
      (profile.certifications &&
        profile.certifications.length > 0) ||
      profile.social_profiles?.linkedin
    ) {
      score += 10;
    }

    return score;
  };

  const handlePhotoUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith("image/")
    ) {
      setError(
        "Please choose a valid image file."
      );
      return;
    }

    const reader = new FileReader();

    reader.onloadend = () => {
      const result = reader.result;

      if (
        typeof result !== "string"
      ) {
        setError(
          "Unable to read the selected image."
        );
        return;
      }

      setProfile((previous) => ({
        ...previous,
        profile_photo: result,
      }));

      setSuccess(false);
      setError("");
    };

    reader.onerror = () => {
      setError(
        "Failed to read the selected image."
      );
    };

    reader.readAsDataURL(file);
  };

  const handleResumeFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      file.type !== "application/pdf"
    ) {
      setError(
        "Only PDF files are allowed."
      );
      return;
    }

    const token = getToken();

    if (!token) {
      redirectToLogin();
      return;
    }

    synchronizeAuthToken(token);

    setUploadingResume(true);
    setError("");
    setSuccess(false);

    const formData = new FormData();

    formData.append(
      "resume",
      file
    );

    try {
      const response = await fetch(
        `${API_URL}/api/profile/upload-resume`,
        {
          method: "POST",
          headers: {
            Authorization:
              buildAuthorizationHeader(
                token
              ),
          },
          body: formData,
        }
      );

      let data: any = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        redirectToLogin();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.message ||
            "Failed to upload resume."
        );
      }

      setProfile((previous) => ({
        ...previous,
        resume_url:
          data?.resume_url ||
          data?.data?.resume_url ||
          "",
      }));

      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      console.error(
        "RESUME UPLOAD ERROR:",
        err
      );

      if (
        err instanceof TypeError
      ) {
        setError(
          "Unable to connect to the backend."
        );
      } else if (
        err instanceof Error
      ) {
        setError(err.message);
      } else {
        setError(
          "Failed to upload resume."
        );
      }
    } finally {
      setUploadingResume(false);
    }
  };

  const addListItem = (
    field: keyof Profile,
    defaultObj: any
  ) => {
    setProfile((previous) => {
      const currentValue =
        previous[field];

      const currentList =
        Array.isArray(currentValue)
          ? currentValue
          : [];

      return {
        ...previous,
        [field]: [
          ...currentList,
          defaultObj,
        ],
      };
    });

    setSuccess(false);
    setError("");
  };

  const removeListItem = (
    field: keyof Profile,
    index: number
  ) => {
    setProfile((previous) => {
      const currentValue =
        previous[field];

      const currentList =
        Array.isArray(currentValue)
          ? currentValue
          : [];

      return {
        ...previous,
        [field]: currentList.filter(
          (_, itemIndex) =>
            itemIndex !== index
        ),
      };
    });

    setSuccess(false);
    setError("");
  };

  const updateListItem = (
    field: keyof Profile,
    index: number,
    key: string,
    value: any
  ) => {
    setProfile((previous) => {
      const currentValue =
        previous[field];

      const currentList: Record<
        string,
        any
      >[] = Array.isArray(
        currentValue
      )
        ? (
            currentValue as Record<
              string,
              any
            >[]
          )
        : [];

      if (
        index < 0 ||
        index >= currentList.length
      ) {
        return previous;
      }

      const updatedList = [
        ...currentList,
      ];

      updatedList[index] = {
        ...(updatedList[index] || {}),
        [key]: value,
      };

      return {
        ...previous,
        [field]: updatedList,
      };
    });

    setSuccess(false);
    setError("");
  };

  const saveSkill = () => {
    if (!skillForm.name.trim()) {
      return;
    }

    setProfile((previous) => {
      const newSkills = [
        ...(previous.skills || []),
      ];

      if (
        editingSkillIndex !== null
      ) {
        newSkills[
          editingSkillIndex
        ] = {
          ...skillForm,
        };
      } else {
        newSkills.push({
          ...skillForm,
        });
      }

      return {
        ...previous,
        skills: newSkills,
      };
    });

    setSkillForm({
      name: "",
      category:
        "Programming Languages",
      level: "Intermediate",
    });

    setEditingSkillIndex(null);
    setSuccess(false);
    setError("");
  };

  const editSkill = (
    index: number
  ) => {
    const selectedSkill =
      profile.skills?.[index];

    if (!selectedSkill) {
      return;
    }

    setEditingSkillIndex(index);

    setSkillForm({
      ...selectedSkill,
    });
  };

  const cancelSkillEdit = () => {
    setEditingSkillIndex(null);

    setSkillForm({
      name: "",
      category:
        "Programming Languages",
      level: "Intermediate",
    });
  };

  const handleRefreshProfile =
    async () => {
      await loadProfile();
    };

  const formattedDate =
    new Date().toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <OverviewSection
            profile={profile}
            calculateCompletion={
              calculateCompletion
            }
            countSkills={
              countSkills
            }
            formattedDate={
              formattedDate
            }
          />
        );

      case "personal":
        return (
          <PersonalInfoSection
            profile={profile}
            handleInputChange={
              handleInputChange
            }
            handlePhotoUpload={
              handlePhotoUpload
            }
            handleSaveProfile={
              handleSaveProfile
            }
            saving={saving}
          />
        );

      case "about":
        return (
          <AboutMeSection
            profile={profile}
            handleInputChange={
              handleInputChange
            }
            handleSaveProfile={
              handleSaveProfile
            }
            saving={saving}
          />
        );

      case "education":
        return (
          <EducationSection
            profile={profile}
            addListItem={
              addListItem
            }
            removeListItem={
              removeListItem
            }
            updateListItem={
              updateListItem
            }
            handleSaveProfile={
              handleSaveProfile
            }
            saving={saving}
          />
        );

      case "skills":
        return (
          <SkillsSection
            profile={profile}
            skillForm={skillForm}
            setSkillForm={
              setSkillForm
            }
            editingSkillIndex={
              editingSkillIndex
            }
            saveSkill={saveSkill}
            editSkill={editSkill}
            removeListItem={
              removeListItem
            }
            cancelSkillEdit={
              cancelSkillEdit
            }
            handleSaveProfile={
              handleSaveProfile
            }
            saving={saving}
          />
        );

      case "projects":
        return (
          <ProjectsSection
            profile={profile}
            addListItem={
              addListItem
            }
            removeListItem={
              removeListItem
            }
            updateListItem={
              updateListItem
            }
            handleSaveProfile={
              handleSaveProfile
            }
            saving={saving}
          />
        );

      case "internships":
        return (
          <InternshipsSection
            profile={profile}
            addListItem={
              addListItem
            }
            removeListItem={
              removeListItem
            }
            updateListItem={
              updateListItem
            }
            handleSaveProfile={
              handleSaveProfile
            }
            saving={saving}
          />
        );

      case "experience":
        return (
          <ExperienceSection
            profile={profile}
            addListItem={
              addListItem
            }
            removeListItem={
              removeListItem
            }
            updateListItem={
              updateListItem
            }
            handleSaveProfile={
              handleSaveProfile
            }
            saving={saving}
          />
        );

      case "certifications":
        return (
          <CertificationsSection
            profile={profile}
            addListItem={
              addListItem
            }
            removeListItem={
              removeListItem
            }
            updateListItem={
              updateListItem
            }
            handleSaveProfile={
              handleSaveProfile
            }
            saving={saving}
          />
        );

      case "achievements":
        return (
          <AchievementsSection
            profile={profile}
            handleInputChange={
              handleInputChange
            }
            handleSaveProfile={
              handleSaveProfile
            }
            saving={saving}
          />
        );

      case "languages":
        return (
          <LanguagesSection
            profile={profile}
            addListItem={
              addListItem
            }
            removeListItem={
              removeListItem
            }
            updateListItem={
              updateListItem
            }
            handleSaveProfile={
              handleSaveProfile
            }
            saving={saving}
          />
        );

      case "socials":
        return (
          <SocialProfilesSection
            profile={profile}
            handleSocialChange={
              handleSocialChange
            }
            handleSaveProfile={
              handleSaveProfile
            }
            saving={saving}
          />
        );

      case "resume":
        return (
          <div className="premium-card p-6 md:p-8 bg-white space-y-4">
            <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wider">
              Manual Resume Upload Deprecated
            </h3>

            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Manual resume PDF uploads are
              deprecated in favor of dynamic,
              real-time AI resume generation.
              Please navigate to the{" "}
              <strong>Live Resume</strong>{" "}
              or{" "}
              <strong>
                AI Career Insights
              </strong>{" "}
              tabs to see your dynamically
              generated resume and ATS
              optimizations.
            </p>
          </div>
        );

      case "live":
        return (
          <LiveResumeSection
            profile={profile}
          />
        );

      case "ai-insights":
        return (
          <AICareerInsights
            profile={profile}
            onRefreshProfile={
              handleRefreshProfile
            }
          />
        );

      case "settings":
        return <SettingsSection />;

      default:
        return (
          <div className="text-slate-500 font-semibold text-sm">
            Select a section in the sidebar.
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {success && (
        <motion.div
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-semibold flex items-center gap-2.5 shadow-sm"
          initial={{
            opacity: 0,
            y: -10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />

          <span>
            Profile changes saved
            successfully! Dashboard
            details have been updated.
          </span>
        </motion.div>
      )}

      {error && (
        <motion.div
          className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold flex items-center gap-2.5 shadow-sm"
          initial={{
            opacity: 0,
            y: -10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />

          <span>{error}</span>
        </motion.div>
      )}

      <div className="transition-all duration-300">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}