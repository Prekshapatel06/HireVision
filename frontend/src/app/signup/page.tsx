"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Target,
  Users,
  BriefcaseBusiness,
} from "lucide-react";

import { HireVisionLogo } from "../../components/HireVisionLogo";

type Role = "candidate" | "recruiter";

interface SignupFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface UserData {
  id: number;
  username: string;
  email: string;
  role: Role;
}

interface SignupResponse {
  message: string;
  token: string;
  user: UserData;
}

interface BackendError {
  detail?: string | Array<{ msg?: string }>;
  message?: string;
  error?: string;
}

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

export default function SignupPage() {
  const router = useRouter();

  const [role, setRole] = useState<Role>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(
        window.location.search
      );

      const initialRole = params.get("role");

      if (
        initialRole === "candidate" ||
        initialRole === "recruiter"
      ) {
        return initialRole;
      }
    }

    return "candidate";
  });

  const [formData, setFormData] =
    useState<SignupFormData>({
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    });

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleOAuthSignup = async (
    provider: "google" | "microsoft"
  ) => {
    if (loading) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const oauthURL =
        `${API_URL}/api/auth/${provider}/url` +
        `?role=${encodeURIComponent(role)}`;

      const response = await fetch(
        oauthURL,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      let data: {
        url?: string;
        message?: string;
        error?: string;
        detail?:
          | string
          | Array<{
              msg?: string;
            }>;
      } | null = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        if (
          data &&
          typeof data.detail === "string" &&
          data.detail.trim()
        ) {
          setError(data.detail);
        } else if (
          data &&
          Array.isArray(data.detail)
        ) {
          setError(
            data.detail
              .map(
                (item) =>
                  item?.msg ||
                  "Invalid authentication request."
              )
              .join(", ")
          );
        } else {
          setError(
            data?.message ||
              data?.error ||
              `Unable to initiate ${provider} registration.`
          );
        }

        return;
      }

      if (!data?.url) {
        setError(
          `Unable to initiate ${provider} registration.`
        );
        return;
      }

      window.location.href = data.url;
    } catch (oauthError) {
      console.error(
        `${provider.toUpperCase()} SIGNUP OAUTH ERROR:`,
        oauthError
      );

      if (
        oauthError instanceof TypeError
      ) {
        setError(
          `Unable to connect to the backend server. Please make sure the backend is running on ${API_URL}.`
        );
      } else {
        setError(
          `Unable to initiate ${provider} registration.`
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): string | null => {
    const username =
      formData.username.trim();

    const email =
      formData.email.trim();

    if (!username) {
      return "Username is required.";
    }

    if (username.length < 3) {
      return "Username must be at least 3 characters.";
    }

    if (username.length > 100) {
      return "Username cannot exceed 100 characters.";
    }

    if (!email) {
      return "Email address is required.";
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return "Please enter a valid email address.";
    }

    if (!formData.password) {
      return "Password is required.";
    }

    if (formData.password.length < 8) {
      return "Password must be at least 8 characters.";
    }

    if (!formData.confirmPassword) {
      return "Please confirm your password.";
    }

    if (
      formData.password !==
      formData.confirmPassword
    ) {
      return "Passwords do not match.";
    }

    if (
      role !== "candidate" &&
      role !== "recruiter"
    ) {
      return "Please select a valid account type.";
    }

    return null;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    setError("");
    setSuccess("");

    const validationError =
      validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const requestBody = {
        username:
          formData.username.trim(),
        email:
          formData.email.trim().toLowerCase(),
        password: formData.password,
        confirmPassword:
          formData.confirmPassword,
        role,
      };

      const response = await fetch(
        `${API_URL}/api/auth/signup`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify(
            requestBody
          ),
        }
      );

      let data:
        | SignupResponse
        | BackendError
        | null = null;

      const responseText =
        await response.text();

      if (responseText) {
        try {
          data = JSON.parse(
            responseText
          );
        } catch {
          data = {
            message: responseText,
          };
        }
      }

      if (!response.ok) {
        let errorMessage =
          "Registration failed. Please try again.";

        if (
          data &&
          "detail" in data &&
          data.detail
        ) {
          if (
            Array.isArray(
              data.detail
            )
          ) {
            errorMessage =
              data.detail
                .map(
                  (item) =>
                    item?.msg ||
                    "Invalid input."
                )
                .join(", ");
          } else {
            errorMessage =
              data.detail;
          }
        } else if (
          data &&
          "message" in data &&
          typeof data.message ===
            "string" &&
          data.message.trim()
        ) {
          errorMessage =
            data.message;
        } else if (
          data &&
          "error" in data &&
          typeof data.error ===
            "string" &&
          data.error.trim()
        ) {
          errorMessage =
            data.error;
        }

        throw new Error(
          errorMessage
        );
      }

      if (
        !data ||
        !("token" in data) ||
        !data.token ||
        !("user" in data) ||
        !data.user
      ) {
        throw new Error(
          "Registration completed, but the server did not return authentication data."
        );
      }

      const signupData =
        data as SignupResponse;

      const savedUser =
        signupData.user;

      if (
        savedUser.role !== "candidate" &&
        savedUser.role !== "recruiter"
      ) {
        throw new Error(
          "Invalid user role returned by the server."
        );
      }

      const savedRole: Role =
        savedUser.role;

      localStorage.setItem(
        "token",
        signupData.token
      );

      localStorage.setItem(
        "hirevision_token",
        signupData.token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(savedUser)
      );

      localStorage.setItem(
        "hirevision_user",
        JSON.stringify(savedUser)
      );

      localStorage.setItem(
        "role",
        savedRole
      );

      localStorage.setItem(
        "hirevision_role",
        savedRole
      );

      localStorage.setItem(
        "hirevision_remember",
        "true"
      );

      setSuccess(
        signupData.message ||
          "Registration successful!"
      );

      setTimeout(() => {
        if (
          savedRole ===
          "recruiter"
        ) {
          router.push(
            "/recruiter-dashboard"
          );
        } else {
          router.push(
            "/dashboard"
          );
        }
      }, 1000);
    } catch (err) {
      console.error(
        "Signup error:",
        err
      );

      if (
        err instanceof TypeError
      ) {
        setError(
          `Unable to connect to the backend server.

Make sure the backend is running at:
${API_URL}`
        );
      } else if (
        err instanceof Error
      ) {
        setError(err.message);
      } else {
        setError(
          "Something went wrong during registration."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="h-dvh w-full overflow-hidden bg-[#f7f8fc] font-inter">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(
              rgba(112, 91, 220, 0.055) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(112, 91, 220, 0.055) 1px,
              transparent 1px
            )
          `,
          backgroundSize: "44px 44px",
        }}
      />

      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_30%_35%,rgba(109,76,255,0.09),transparent_32%),radial-gradient(circle_at_82%_70%,rgba(139,92,246,0.08),transparent_30%)]" />

      <div className="relative z-10 grid h-dvh w-full grid-cols-[55%_45%]">
        <section className="relative flex h-dvh flex-col px-[8.5%] py-[30px]">
          <Link
            href="/"
            className="flex w-fit items-center gap-[16px]"
          >
            <div className="flex h-[78px] w-[78px] shrink-0 items-center justify-center overflow-visible">
              <HireVisionLogo
                className="
                  h-[77px]
                  w-[77px]
                  scale-[1.35]
                "
              />
            </div>

            <div className="flex flex-col justify-center">
              <span className="font-poppins text-[34px] font-extrabold leading-none tracking-[-1.3px] text-[#111827]">
                HireVision
              </span>

              <span className="mt-[6px] text-[15px] leading-none text-[#718096]">
                AI Powered Recruitment
              </span>
            </div>
          </Link>

          <div className="flex flex-1 flex-col justify-center pb-[12px]">
            <div className="mb-[34px] flex w-fit items-center gap-[10px] rounded-full border border-[#e5d9ff] bg-white px-[21px] py-[11px] shadow-[0_3px_12px_rgba(90,60,180,0.04)]">
              <ShieldCheck className="h-[18px] w-[18px] text-[#8b3df5]" />

              <span className="text-[14px] font-bold text-[#7628e8]">
                Trusted by 10,000+ Recruiters Worldwide
              </span>
            </div>

            <h1 className="font-poppins text-[60px] font-extrabold leading-[1.03] tracking-[-2.8px] text-[#101828]">
              Smarter Hiring

              <br />

              <span className="bg-gradient-to-r from-[#4556e8] via-[#6839ef] to-[#9c22ed] bg-clip-text text-transparent">
                Better Outcomes
              </span>
            </h1>

            <p className="mt-[24px] max-w-[700px] text-[17px] font-medium leading-[1.65] text-[#718096]">
              HireVision helps recruiters discover, analyse and hire top
              talent using AI-powered resume screening, intelligent candidate
              matching and smart hiring insights.
            </p>

            <div className="mt-[36px] grid w-full max-w-[900px] grid-cols-2 gap-x-[28px] gap-y-[22px]">
              <StatCard
                icon={<FileText />}
                title="Resume Score"
                value="96%"
                badge="+12%"
              />

              <StatCard
                icon={<Target />}
                title="Job Match"
                value="92%"
                badge="+8"
              />

              <StatCard
                icon={<Users />}
                title="Interview Ready"
                value="YES"
                badge="Ready"
              />

              <StatCard
                icon={<BriefcaseBusiness />}
                title="Applications"
                value="18"
                badge="+4"
              />
            </div>
          </div>

          <div className="flex items-center gap-[8px] pb-[3px]">
            <span className="h-[9px] w-[9px] rounded-full bg-[#8b3df5]" />
            <span className="h-[9px] w-[9px] rounded-full bg-[#ddd4ff]" />
            <span className="h-[9px] w-[9px] rounded-full bg-[#ddd4ff]" />
          </div>
        </section>

        <section className="flex h-dvh items-center justify-center px-[3.5%] py-[20px]">
          <motion.div
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.25,
            }}
            className="flex h-[calc(100dvh-40px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[30px] border border-white bg-white px-[40px] py-[26px] shadow-[0_25px_70px_rgba(57,48,110,0.14)]"
          >
            <div className="shrink-0 text-center">
              <div className="mx-auto flex h-[55px] w-[55px] items-center justify-center overflow-visible">
                <HireVisionLogo
                  className="
                    h-[55px]
                    w-[55px]
                    scale-[1.18]
                  "
                />
              </div>

              <h2 className="mt-[7px] font-poppins text-[31px] font-extrabold leading-none tracking-[-1.3px] text-[#101828]">
                Create Account
              </h2>

              <p className="mx-auto mt-[7px] max-w-[350px] text-[12px] font-medium leading-[1.4] text-[#718096]">
                Create your HireVision account and start building your professional profile.
              </p>
            </div>

            <div className="mt-[12px] shrink-0">
              <p className="mb-[5px] text-[11px] font-bold text-[#374151]">
                I am a:
              </p>

              <div className="relative flex h-[38px] rounded-full bg-[#f4f0ff] p-[3px]">
                <motion.div
                  className="absolute top-[3px] bottom-[3px] rounded-full bg-gradient-to-r from-[#7026f4] to-[#6536ef]"
                  animate={{
                    left:
                      role === "candidate"
                        ? "3px"
                        : "50%",
                  }}
                  transition={{
                    duration: 0.2,
                  }}
                  style={{
                    width:
                      "calc(50% - 3px)",
                  }}
                />

                <button
                  type="button"
                  onClick={() => {
                    setRole("candidate");
                    setError("");
                    setSuccess("");
                  }}
                  disabled={loading}
                  className={`relative z-10 w-1/2 rounded-full text-[11px] font-bold ${
                    role === "candidate"
                      ? "text-white"
                      : "text-[#667085]"
                  }`}
                >
                  Candidate
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRole("recruiter");
                    setError("");
                    setSuccess("");
                  }}
                  disabled={loading}
                  className={`relative z-10 w-1/2 rounded-full text-[11px] font-bold ${
                    role === "recruiter"
                      ? "text-white"
                      : "text-[#667085]"
                  }`}
                >
                  Recruiter
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                className="mt-[7px] flex shrink-0 items-start gap-2 rounded-[10px] border border-red-100 bg-red-50 p-[7px] text-[10px] font-semibold leading-[1.3] text-red-600"
                initial={{
                  opacity: 0,
                  y: -5,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
              >
                <AlertCircle className="mt-[1px] h-[13px] w-[13px] shrink-0" />

                <span className="whitespace-pre-line">
                  {error}
                </span>
              </motion.div>
            )}

            {success && (
              <motion.div
                className="mt-[7px] flex shrink-0 items-start gap-2 rounded-[10px] border border-emerald-100 bg-emerald-50 p-[7px] text-[10px] font-semibold leading-[1.3] text-emerald-700"
                initial={{
                  opacity: 0,
                  y: -5,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
              >
                <CheckCircle2 className="mt-[1px] h-[13px] w-[13px] shrink-0" />

                <span>
                  {success}
                </span>
              </motion.div>
            )}

            <form
              onSubmit={handleSubmit}
              className="mt-[10px] shrink-0 space-y-[7px]"
            >
              <SignupInput
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="johndoe"
                autoComplete="username"
                disabled={loading}
                icon={<User />}
              />

              <SignupInput
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@example.com"
                autoComplete="email"
                disabled={loading}
                icon={<Mail />}
              />

              <PasswordField
                label="Password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={loading}
                visible={showPassword}
                onToggle={() =>
                  setShowPassword(
                    (previous) =>
                      !previous
                  )
                }
              />

              <PasswordField
                label="Confirm Password"
                name="confirmPassword"
                value={
                  formData.confirmPassword
                }
                onChange={handleChange}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={loading}
                visible={
                  showConfirmPassword
                }
                onToggle={() =>
                  setShowConfirmPassword(
                    (previous) =>
                      !previous
                  )
                }
              />

              <button
                type="submit"
                disabled={loading}
                className="mt-[3px] flex h-[43px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#5542e9] via-[#7438ef] to-[#a63cf0] text-[12px] font-bold text-white shadow-[0_7px_20px_rgba(113,58,225,0.25)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-[14px] w-[14px] animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            <div className="my-[10px] flex shrink-0 items-center">
              <div className="flex-1 border-t border-[#e5e7eb]" />

              <span className="mx-[11px] text-[9px] font-medium text-[#9ca3af]">
                Or continue with
              </span>

              <div className="flex-1 border-t border-[#e5e7eb]" />
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-[9px]">
              <button
                type="button"
                onClick={() =>
                  handleOAuthSignup(
                    "google"
                  )
                }
                disabled={loading}
                className="flex h-[36px] items-center justify-center gap-[7px] rounded-full border border-[#e5e7eb] text-[10px] font-bold text-[#475467] transition hover:bg-[#fafafa] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GoogleIcon />
                Google
              </button>

              <button
                type="button"
                onClick={() =>
                  handleOAuthSignup(
                    "microsoft"
                  )
                }
                disabled={loading}
                className="flex h-[36px] items-center justify-center gap-[7px] rounded-full border border-[#e5e7eb] text-[10px] font-bold text-[#475467] transition hover:bg-[#fafafa] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MicrosoftIcon />
                Microsoft
              </button>
            </div>

            <p className="mt-[11px] shrink-0 text-center text-[10px] font-medium text-[#667085]">
              Already have an account?{" "}

              <Link
                href={`/login?role=${role}`}
                className="font-bold text-[#374151] hover:text-purple-600 hover:underline"
              >
                Log In
              </Link>
            </p>

            <p className="mt-[7px] shrink-0 text-center text-[8px] font-medium leading-relaxed text-[#98a2b3]">
              By signing up you agree to our{" "}

              <a
                href="#"
                className="underline"
              >
                Terms of Service
              </a>

              {" "}and{" "}

              <a
                href="#"
                className="underline"
              >
                Privacy Policy
              </a>
            </p>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

function SignupInput({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  icon,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  placeholder: string;
  autoComplete?: string;
  disabled?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-[4px] block text-[10px] font-bold text-[#374151]">
        {label}
      </label>

      <div className="relative">
        <div className="absolute left-[14px] top-1/2 -translate-y-1/2 text-[#94a3b8]">
          {React.cloneElement(
            icon as React.ReactElement<{
              className?: string;
              strokeWidth?: number;
            }>,
            {
              className:
                "h-[15px] w-[15px]",
              strokeWidth: 2,
            }
          )}
        </div>

        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required
          className="h-[42px] w-full rounded-full border border-[#dbe3fb] bg-[#edf2ff] pl-[40px] pr-[14px] text-[11px] text-[#1f2937] outline-none placeholder:text-[#8994a8] transition-all focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-200 disabled:opacity-60"
        />
      </div>
    </div>
  );
}

function PasswordField({
  label,
  name,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  visible,
  onToggle,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  placeholder: string;
  autoComplete?: string;
  disabled?: boolean;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <label className="mb-[4px] block text-[10px] font-bold text-[#374151]">
        {label}
      </label>

      <div className="relative">
        <Lock className="absolute left-[14px] top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#94a3b8]" />

        <input
          type={
            visible
              ? "text"
              : "password"
          }
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required
          className="h-[42px] w-full rounded-full border border-[#dbe3fb] bg-[#edf2ff] pl-[40px] pr-[42px] text-[11px] text-[#1f2937] outline-none placeholder:text-[#8994a8] transition-all focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-200 disabled:opacity-60"
        />

        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className="absolute right-[14px] top-1/2 -translate-y-1/2 text-[#9ca3af] transition-colors hover:text-purple-600 disabled:opacity-50"
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
        >
          {visible ? (
            <EyeOff className="h-[15px] w-[15px]" />
          ) : (
            <Eye className="h-[15px] w-[15px]" />
          )}
        </button>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  badge: string;
}) {
  return (
    <div className="h-[132px] w-full min-w-0 rounded-[23px] border border-[#ebe7f7] bg-white px-[20px] py-[17px] shadow-[0_7px_25px_rgba(75,60,150,0.07)]">
      <div className="flex items-start justify-between">
        <div className="flex h-[45px] w-[45px] shrink-0 items-center justify-center rounded-full bg-[#f5efff] text-[#883cf0]">
          {React.cloneElement(
            icon as React.ReactElement<{
              className?: string;
              strokeWidth?: number;
            }>,
            {
              className:
                "h-[20px] w-[20px]",
              strokeWidth: 2,
            }
          )}
        </div>

        <span className="rounded-full bg-[#f6f0ff] px-[11px] py-[6px] text-[10px] font-bold text-[#8a35ef]">
          {badge}
        </span>
      </div>

      <div className="mt-[12px] flex items-end justify-between gap-3">
        <p className="truncate text-[14px] font-medium text-[#718096]">
          {title}
        </p>

        <p className="shrink-0 font-poppins text-[27px] font-extrabold leading-none text-[#101828]">
          {value}
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      className="h-[14px] w-[14px]"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />

      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />

      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />

      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg
      className="h-[14px] w-[14px]"
      viewBox="0 0 23 23"
    >
      <rect
        x="0"
        y="0"
        width="10.5"
        height="10.5"
        fill="#f25022"
      />

      <rect
        x="11.5"
        y="0"
        width="10.5"
        height="10.5"
        fill="#7fba00"
      />

      <rect
        x="0"
        y="11.5"
        width="10.5"
        height="10.5"
        fill="#00a4ef"
      />

      <rect
        x="11.5"
        y="11.5"
        width="10.5"
        height="10.5"
        fill="#ffb900"
      />
    </svg>
  );
}