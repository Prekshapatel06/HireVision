"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function ResumeRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  useEffect(() => {
    if (userId) {
      router.replace(`/resume/share/${userId}`);
    } else {
      router.replace("/dashboard");
    }
  }, [userId, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      <span className="font-poppins font-semibold text-xs">Loading Candidate Live Resume...</span>
    </div>
  );
}

export default function ResumePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="font-poppins font-semibold text-xs">Loading Candidate Live Resume...</span>
        </div>
      }
    >
      <ResumeRedirectContent />
    </Suspense>
  );
}
