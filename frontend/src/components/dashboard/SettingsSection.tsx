import React from "react";
import {
  ShieldCheck,
  LockKeyhole,
  Database,
  KeyRound,
  CheckCircle2,
} from "lucide-react";

export default function SettingsSection() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Security Policy */}
      <div className="premium-card p-6 bg-white space-y-4 border border-slate-100">
        <h3 className="font-poppins font-bold text-slate-800 text-sm border-b border-purple-100 pb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-purple-600" />
          Security Policy
        </h3>

        <p className="text-xs text-slate-500 leading-relaxed">
          All stored passwords are encrypted using bcrypt hashing. Database
          pools are secured against SQL injections. JWT security tokens verify
          access to candidate forms.
        </p>

        <div className="flex items-center gap-2 px-3 py-2.5 bg-purple-50 border border-purple-100 rounded-[12px]">
          <CheckCircle2 className="h-4 w-4 text-purple-600 shrink-0" />
          <span className="text-[11px] font-bold text-purple-700">
            Your account security is currently active.
          </span>
        </div>
      </div>

      {/* Account Security */}
      <div className="premium-card p-6 bg-white space-y-4 border border-slate-100">
        <h3 className="font-poppins font-bold text-slate-800 text-sm border-b border-purple-100 pb-3 flex items-center gap-2">
          <LockKeyhole className="h-5 w-5 text-violet-600" />
          Account Security
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-[12px]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-purple-50 flex items-center justify-center">
                <KeyRound className="h-4 w-4 text-purple-600" />
              </div>

              <div>
                <p className="text-xs font-bold text-slate-700">
                  Password Protection
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  Password is securely hashed
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 bg-purple-50 border border-purple-100 text-purple-700 text-[9px] font-bold rounded-full uppercase">
              Protected
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-[12px]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-violet-50 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-violet-600" />
              </div>

              <div>
                <p className="text-xs font-bold text-slate-700">
                  Authentication
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  Secure token-based access
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 bg-violet-50 border border-violet-100 text-violet-700 text-[9px] font-bold rounded-full uppercase">
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Data Protection */}
      <div className="premium-card p-6 bg-white space-y-4 border border-slate-100">
        <h3 className="font-poppins font-bold text-slate-800 text-sm border-b border-purple-100 pb-3 flex items-center gap-2">
          <Database className="h-5 w-5 text-indigo-600" />
          Data Protection
        </h3>

        <p className="text-xs text-slate-500 leading-relaxed">
          Your profile information is handled through protected application
          services. Sensitive authentication data is not stored in plain text.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-purple-50 border border-purple-100 rounded-[12px]">
            <p className="text-[9px] text-purple-500 font-bold uppercase tracking-wider">
              Passwords
            </p>
            <p className="text-xs text-purple-700 font-bold mt-1">
              Encrypted
            </p>
          </div>

          <div className="p-3 bg-indigo-50 border border-purple-100 rounded-[12px]">
            <p className="text-[9px] text-purple-500 font-bold uppercase tracking-wider">
              Access
            </p>
            <p className="text-xs text-purple-700 font-bold mt-1">
              Protected
            </p>
          </div>
        </div>
      </div>

      {/* Security Status */}
      <div className="premium-card p-6 bg-white border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-purple-600" />
          </div>

          <div>
            <h4 className="font-poppins font-bold text-sm text-slate-800">
              Security Status
            </h4>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
              Your account is protected with the available security measures.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}