"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  FileText,
  Target,
  Users,
  BriefcaseBusiness,
} from "lucide-react";

import { HireVisionLogo } from "../../components/HireVisionLogo";

type Role = "candidate" | "recruiter";

interface LoginUser {
  id: number;
  username: string;
  email: string;
  role: Role;
}

interface LoginResponse {
  token?: string;
  access_token?: string;
  accessToken?: string;
  user?: LoginUser;
  message?: string;
  error?: string;
  detail?:
    | string
    | Array<{
        msg?: string;
      }>;
}

interface MeResponse {
  user?: LoginUser & {
    created_at?: string;
  };
}

class RequestTimeoutError extends Error {
  constructor(message = "The request timed out.") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const AUTH_TOKEN_KEYS = ["token", "hirevision_token"] as const;
const AUTH_USER_KEYS = ["user", "hirevision_user"] as const;
const AUTH_ROLE_KEYS = ["role", "hirevision_role"] as const;

function normalizeToken(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  let token = value.trim();

  if (!token) {
    return "";
  }

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }

  return token;
}

function clearAuthStorage() {
  if (typeof window === "undefined") {
    return;
  }

  for (const key of AUTH_TOKEN_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  for (const key of AUTH_USER_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  for (const key of AUTH_ROLE_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  localStorage.removeItem("hirevision_remember");
  sessionStorage.removeItem("hirevision_remember");
}

function saveAuthSession(
  token: string,
  user: LoginUser,
  role: Role,
  remember: boolean
) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedToken = normalizeToken(token);

  if (!normalizedToken) {
    throw new Error("The authentication server returned an invalid token.");
  }

  const storage = remember ? localStorage : sessionStorage;
  const otherStorage = remember ? sessionStorage : localStorage;

  for (const key of AUTH_TOKEN_KEYS) {
    otherStorage.removeItem(key);
  }

  for (const key of AUTH_USER_KEYS) {
    otherStorage.removeItem(key);
  }

  for (const key of AUTH_ROLE_KEYS) {
    otherStorage.removeItem(key);
  }

  otherStorage.removeItem("hirevision_remember");

  for (const key of AUTH_TOKEN_KEYS) {
    storage.setItem(key, normalizedToken);
  }

  for (const key of AUTH_USER_KEYS) {
    storage.setItem(key, JSON.stringify(user));
  }

  for (const key of AUTH_ROLE_KEYS) {
    storage.setItem(key, role);
  }

  if (remember) {
    localStorage.setItem("hirevision_remember", "true");
  } else {
    localStorage.removeItem("hirevision_remember");
    sessionStorage.setItem("hirevision_remember", "false");
  }

  window.dispatchEvent(
    new CustomEvent("hirevision-auth-changed", {
      detail: {
        token: normalizedToken,
        user,
        role,
      },
    })
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof RequestTimeoutError) {
    return error.message;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return "The request was cancelled. Please try again.";
  }

  if (error instanceof TypeError) {
    return `Unable to connect to the backend server at ${API_URL}.`;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeout = 20000
): Promise<Response> {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new RequestTimeoutError(
        "The backend server did not respond within the allowed time."
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function parseBackendError(
  data: LoginResponse | null,
  status: number
): string {
  if (!data) {
    return `Server returned status ${status}.`;
  }

  if (typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }

  if (typeof data.error === "string" && data.error.trim()) {
    return data.error.trim();
  }

  if (typeof data.detail === "string" && data.detail.trim()) {
    return data.detail.trim();
  }

  if (Array.isArray(data.detail)) {
    const messages = data.detail
      .map((item) => item?.msg?.trim())
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(", ");
    }
  }

  return `Server returned status ${status}.`;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlRole = searchParams.get("role");
  const oauthToken = normalizeToken(searchParams.get("token"));
  const oauthError = searchParams.get("error");
  const signupParam = searchParams.get("signup");

  const [role, setRole] = useState<Role>(
    urlRole === "recruiter" ? "recruiter" : "candidate"
  );

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return localStorage.getItem("hirevision_remember") === "true";
  });

  const [error, setError] = useState<string>(() => {
    if (!oauthError) {
      return "";
    }

    try {
      return decodeURIComponent(oauthError);
    } catch {
      return oauthError;
    }
  });

  const [loading, setLoading] = useState(false);

  const [signupSuccess, setSignupSuccess] = useState(
    signupParam === "success"
  );

  useEffect(() => {
    const savedRemember =
      localStorage.getItem("hirevision_remember") === "true";

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRememberMe(savedRemember);
  }, []);

  useEffect(() => {
    if (urlRole === "candidate" || urlRole === "recruiter") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRole(urlRole);
    }
  }, [urlRole]);

  useEffect(() => {
    if (!oauthToken) {
      return;
    }

    let cancelled = false;

    const completeOAuthLogin = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetchWithTimeout(
          `${API_URL}/api/auth/me`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${oauthToken}`,
            },
            cache: "no-store",
          },
          20000
        );

        let data: MeResponse | null = null;

        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (!response.ok) {
          throw new Error(
            "Google authentication succeeded, but the session could not be verified."
          );
        }

        const user = data?.user;

        if (!user) {
          throw new Error(
            "Google authentication succeeded, but user information was not returned."
          );
        }

        if (
          user.role !== "candidate" &&
          user.role !== "recruiter"
        ) {
          throw new Error(
            "Invalid user role returned by the server."
          );
        }

        if (cancelled) {
          return;
        }

        const backendRole: Role = user.role;

        clearAuthStorage();

        saveAuthSession(
          oauthToken,
          user,
          backendRole,
          rememberMe
        );

        const redirectPath =
          backendRole === "recruiter"
            ? "/recruiter-dashboard"
            : "/dashboard";

        router.replace(redirectPath);
      } catch (oauthCallbackError) {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(oauthCallbackError));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    completeOAuthLogin();

    return () => {
      cancelled = true;
    };
  }, [oauthToken, router, rememberMe]);

  const handleOAuthLogin = async (
    provider: "google" | "microsoft"
  ) => {
    if (loading) {
      return;
    }

    setLoading(true);
    setError("");
    setSignupSuccess(false);

    try {
      const oauthURL =
        `${API_URL}/api/auth/${provider}/url` +
        `?role=${encodeURIComponent(role)}`;

      const response = await fetchWithTimeout(
        oauthURL,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        },
        20000
      );

      let data: {
        url?: string;
        message?: string;
        error?: string;
        detail?: string;
      } | null = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        setError(
          data?.message ||
            data?.error ||
            data?.detail ||
            `Unable to start ${provider} authentication.`
        );

        setLoading(false);
        return;
      }

      if (!data?.url) {
        setError(
          `Unable to start ${provider} authentication. The server did not return an OAuth URL.`
        );

        setLoading(false);
        return;
      }

      window.location.assign(data.url);
    } catch (oauthError) {
      setError(getErrorMessage(oauthError));
      setLoading(false);
    }
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
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    const email = formData.email.trim();
    const password = formData.password;

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    setError("");
    setSignupSuccess(false);

    try {
      const response = await fetchWithTimeout(
        `${API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            role,
          }),
        },
        20000
      );

      let data: LoginResponse | null = null;

      const contentType =
        response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch {
          data = null;
        }
      } else {
        try {
          const text = await response.text();

          data = {
            message:
              text ||
              `Server returned status ${response.status}.`,
          };
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        setError(
          parseBackendError(
            data,
            response.status
          )
        );
        return;
      }

      const token = normalizeToken(
        data?.token ||
          data?.access_token ||
          data?.accessToken
      );

      if (!token) {
        setError(
          "Login succeeded, but the server did not return an authentication token."
        );
        return;
      }

      const user = data?.user;

      if (!user) {
        setError(
          "Login succeeded, but user information was not returned by the server."
        );
        return;
      }

      if (
        user.role !== "candidate" &&
        user.role !== "recruiter"
      ) {
        setError(
          "Invalid user role returned by the server."
        );
        return;
      }

      const backendRole: Role = user.role;

      clearAuthStorage();

      saveAuthSession(
        token,
        user,
        backendRole,
        rememberMe
      );

      if (backendRole === "candidate") {
        router.replace("/dashboard");
      } else {
        router.replace("/recruiter-dashboard");
      }
    } catch (loginError) {
      setError(getErrorMessage(loginError));
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
                className="h-[77px] w-[77px] scale-[1.35]"
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

        <section className="flex h-dvh items-center justify-center px-[4.5%] py-[20px]">
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
            className="h-[calc(100dvh-40px)] w-full max-w-[520px] overflow-hidden rounded-[30px] border border-white bg-white px-[40px] py-[33px] shadow-[0_25px_70px_rgba(57,48,110,0.14)]"
          >
            <div className="text-center">
              <div className="mx-auto flex h-[63px] w-[63px] items-center justify-center overflow-visible">
                <HireVisionLogo
                  className="h-[63px] w-[63px] scale-[1.2]"
                />
              </div>

              <h2 className="mt-[15px] font-poppins text-[36px] font-extrabold leading-none tracking-[-1.5px] text-[#101828]">
                Welcome Back
              </h2>

              <p className="mx-auto mt-[14px] max-w-[365px] text-[14px] font-medium leading-[1.55] text-[#718096]">
                Sign in to continue managing candidates, AI resume analysis
                and recruitment.
              </p>
            </div>

            <p className="mt-[18px] mb-[7px] text-[12px] font-bold text-[#374151]">
              I am a:
            </p>

            <div className="relative flex h-[42px] rounded-full bg-[#f4f0ff] p-[3px]">
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
                  width: "calc(50% - 3px)",
                }}
              />

              <button
                type="button"
                onClick={() => {
                  setRole("candidate");
                  setError("");
                }}
                disabled={loading}
                className={`relative z-10 w-1/2 rounded-full text-[12px] font-bold ${
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
                }}
                disabled={loading}
                className={`relative z-10 w-1/2 rounded-full text-[12px] font-bold ${
                  role === "recruiter"
                    ? "text-white"
                    : "text-[#667085]"
                }`}
              >
                Recruiter
              </button>
            </div>

            {signupSuccess && (
              <motion.div
                className="mt-[10px] flex items-start gap-2 rounded-[10px] border border-emerald-100 bg-emerald-50 p-2.5 text-[11px] font-semibold text-emerald-700"
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
              >
                <CheckCircle2 className="mt-[1px] h-[14px] w-[14px] shrink-0" />

                <span>
                  Account created successfully! Please log in below.
                </span>
              </motion.div>
            )}

            {error && (
              <motion.div
                className="mt-[10px] flex items-start gap-2 rounded-[10px] border border-red-100 bg-red-50 p-2.5 text-[11px] font-semibold text-red-600"
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
              >
                <AlertCircle className="mt-[1px] h-[14px] w-[14px] shrink-0" />

                <span className="break-words">
                  {error}
                </span>
              </motion.div>
            )}

            <form
              onSubmit={handleSubmit}
              className="mt-[17px]"
            >
              <div>
                <label className="mb-[6px] block text-[12px] font-bold text-[#374151]">
                  Email Address
                </label>

                <div className="relative">
                  <Mail className="absolute left-[15px] top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#9aa8bd]" />

                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@example.com"
                    autoComplete="email"
                    required
                    disabled={loading}
                    className="h-[46px] w-full rounded-full border border-[#dbe3fb] bg-[#edf2ff] pl-[43px] pr-[15px] text-[13px] text-[#1f2937] outline-none placeholder:text-[#8994a8] focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>
              </div>

              <div className="mt-[14px]">
                <label className="mb-[6px] block text-[12px] font-bold text-[#374151]">
                  Password
                </label>

                <div className="relative">
                  <Lock className="absolute left-[15px] top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#9aa8bd]" />

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    className="h-[46px] w-full rounded-full border border-[#dbe3fb] bg-[#edf2ff] pl-[43px] pr-[45px] text-[13px] text-[#1f2937] outline-none placeholder:text-[#8994a8] focus:border-[#8b5cf6] focus:ring-2 focus:ring-purple-200 disabled:cursor-not-allowed disabled:opacity-70"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (previous) =>
                          !previous
                      )
                    }
                    disabled={loading}
                    className="absolute right-[15px] top-1/2 -translate-y-1/2 text-[#9aa8bd] hover:text-purple-600 disabled:cursor-not-allowed"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-[17px] w-[17px]" />
                    ) : (
                      <Eye className="h-[17px] w-[17px]" />
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-[14px] flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-[7px] text-[12px] font-semibold text-[#667085]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) =>
                      setRememberMe(
                        e.target.checked
                      )
                    }
                    disabled={loading}
                    className="h-[15px] w-[15px] cursor-pointer accent-purple-600"
                  />

                  Remember me
                </label>

                <button
                  type="button"
                  onClick={() =>
                    alert(
                      "Forgot Password feature coming soon!"
                    )
                  }
                  disabled={loading}
                  className="text-[12px] font-bold text-[#1f2937] hover:text-purple-600 disabled:cursor-not-allowed"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-[15px] flex h-[46px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#5542e9] via-[#7438ef] to-[#a63cf0] text-[13px] font-bold text-white shadow-[0_7px_20px_rgba(113,58,225,0.25)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-[15px] w-[15px] animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Log In"
                )}
              </button>
            </form>

            <div className="my-[14px] flex items-center">
              <div className="flex-1 border-t border-[#e5e7eb]" />

              <span className="mx-[13px] text-[10px] font-medium text-[#9ca3af]">
                Or continue with
              </span>

              <div className="flex-1 border-t border-[#e5e7eb]" />
            </div>

            <div className="grid grid-cols-2 gap-[10px]">
              <button
                type="button"
                onClick={() =>
                  handleOAuthLogin("google")
                }
                disabled={loading}
                className="flex h-[39px] items-center justify-center gap-[8px] rounded-full border border-[#e5e7eb] text-[11px] font-bold text-[#475467] transition hover:bg-[#fafafa] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GoogleIcon />
                Google
              </button>

              <button
                type="button"
                onClick={() =>
                  handleOAuthLogin("microsoft")
                }
                disabled={loading}
                className="flex h-[39px] items-center justify-center gap-[8px] rounded-full border border-[#e5e7eb] text-[11px] font-bold text-[#475467] transition hover:bg-[#fafafa] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MicrosoftIcon />
                Microsoft
              </button>
            </div>

            <p className="mt-[17px] text-center text-[12px] font-medium text-[#667085]">
              Don&apos;t have an account?{" "}

              <Link
                href={`/signup?role=${role}`}
                className="font-bold text-[#374151] hover:text-purple-600 hover:underline"
              >
                Create Account
              </Link>
            </p>

            <p className="mt-[18px] text-center text-[9px] font-medium leading-relaxed text-[#98a2b3]">
              By signing in you agree to our{" "}

              <a
                href="#"
                className="underline"
              >
                Terms of Service
              </a>{" "}

              and{" "}

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
          {React.isValidElement(icon)
            ? React.cloneElement(
                icon as React.ReactElement<{
                  className?: string;
                  strokeWidth?: number;
                }>,
                {
                  className: "h-[20px] w-[20px]",
                  strokeWidth: 2,
                }
              )
            : icon}
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
      className="h-[15px] w-[15px]"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74-3.28-8.09z"
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
      className="h-[15px] w-[15px]"
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

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}