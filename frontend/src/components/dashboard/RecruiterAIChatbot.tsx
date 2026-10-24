"use client";

import React from "react";
import FloatingAIAgent from "./FloatingAIAgent";

interface RecruiterAIChatbotProps {
  token?: string | null;
  profile?: any;
}

/**
 * RecruiterAIChatbot
 *
 * Provides 100% visual and functional parity with the Candidate Floating AI Agent,
 * configured specifically for recruiter intelligence, applicant ranking, job matching,
 * and talent insights.
 */
export default function RecruiterAIChatbot({
  token,
  profile,
}: RecruiterAIChatbotProps = {}) {
  return <FloatingAIAgent mode="recruiter" token={token} profile={profile} />;
}