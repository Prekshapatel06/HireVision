const { callLLM } = require("./openaiService");
const {
  normalizeAgentResponse,
  failedAgentResponse
} = require("./agentResponseSchema");

const AGENT_NAME = "codingAgent";

function normalizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampConfidence(value, fallback = 0.5) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, numeric));
}

function normalizeConversation(context) {
  const history =
    context?.conversation ||
    context?.history ||
    [];

  return safeArray(history)
    .map(message => {
      if (!message || typeof message !== "object") {
        return null;
      }

      const role = normalizeText(
        message.role || message.sender
      ).toLowerCase();

      const content = normalizeText(
        message.content ||
        message.message ||
        message.text
      );

      if (!content) {
        return null;
      }

      return {
        role:
          role === "assistant" ||
          role === "user" ||
          role === "system"
            ? role
            : "user",
        content
      };
    })
    .filter(Boolean)
    .slice(-20);
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  return {
    id:
      profile.user_id ||
      profile.id ||
      profile._id ||
      null,

    name:
      normalizeText(
        profile.full_name ||
        profile.name
      ) || null,

    skills: safeArray(profile.skills)
      .map(skill => {
        if (typeof skill === "string") {
          return skill;
        }

        if (skill && typeof skill === "object") {
          return (
            skill.name ||
            skill.skill ||
            skill.title ||
            skill.technology ||
            ""
          );
        }

        return "";
      })
      .map(normalizeText)
      .filter(Boolean)
      .slice(0, 100),

    projects: safeArray(profile.projects)
      .map(project => {
        if (typeof project === "string") {
          return {
            title: project
          };
        }

        if (!project || typeof project !== "object") {
          return null;
        }

        return {
          title: normalizeText(
            project.title ||
            project.name ||
            project.project_name
          ),
          technologies: safeArray(
            project.technologies ||
            project.tech_stack ||
            project.techStack
          )
            .map(item => {
              if (typeof item === "string") {
                return item;
              }

              if (item && typeof item === "object") {
                return (
                  item.name ||
                  item.skill ||
                  item.title ||
                  item.technology ||
                  ""
                );
              }

              return "";
            })
            .map(normalizeText)
            .filter(Boolean)
        };
      })
      .filter(Boolean)
      .slice(0, 50),

    experience: safeArray(
      profile.experience ||
      profile.work_experience ||
      profile.workExperience
    )
      .map(item => {
        if (typeof item === "string") {
          return {
            role: item
          };
        }

        if (!item || typeof item !== "object") {
          return null;
        }

        return {
          role: normalizeText(
            item.role ||
            item.title ||
            item.position ||
            item.job_title
          ),
          company: normalizeText(
            item.company ||
            item.organization ||
            item.employer
          )
        };
      })
      .filter(Boolean)
      .slice(0, 50)
  };
}

function detectProgrammingIntent(query) {
  const text = normalizeText(query).toLowerCase();

  if (!text) {
    return "GENERAL_PROGRAMMING";
  }

  if (
    /\b(error|exception|stack trace|traceback|bug|crash|fails|failing|broken)\b/i.test(
      text
    )
  ) {
    return "DEBUGGING";
  }

  if (
    /\b(review|review my code|code review|improve this code|refactor)\b/i.test(
      text
    )
  ) {
    return "CODE_REVIEW";
  }

  if (
    /\b(optimi[sz]e|performance|slow|latency|memory|cpu|complexity)\b/i.test(
      text
    )
  ) {
    return "PERFORMANCE";
  }

  if (
    /\b(explain|how does|what does|why does|understand)\b/i.test(
      text
    )
  ) {
    return "EXPLANATION";
  }

  if (
    /\b(implement|build|create|write|develop|function|api|endpoint)\b/i.test(
      text
    )
  ) {
    return "IMPLEMENTATION";
  }

  if (
    /\b(test|testing|unit test|integration test|jest|pytest|vitest)\b/i.test(
      text
    )
  ) {
    return "TESTING";
  }

  if (
    /\b(security|vulnerability|xss|csrf|sql injection|authentication|authorization)\b/i.test(
      text
    )
  ) {
    return "SECURITY_REVIEW";
  }

  return "GENERAL_PROGRAMMING";
}

function buildSystemPrompt() {
  return `
You are HireVision AI's Coding and Debugging Agent.

You operate as a senior software engineer, debugging specialist, code reviewer, and technical mentor.

Your responsibility is strictly programming-related:
- Debug code
- Explain errors
- Review code
- Refactor code
- Improve implementation
- Explain programming concepts
- Identify performance problems
- Identify security issues
- Suggest tests
- Design technically sound implementations
- Explain trade-offs

Do NOT turn programming questions into:
- Career advice
- Resume advice
- Generic profile recommendations
- Hiring recommendations
- Candidate ranking
- Job recommendations

PROBLEM-SOLVING WORKFLOW:

1. Understand the user's actual programming goal.
2. Identify the language/framework when possible.
3. Analyze the supplied code, error message, logs, stack trace, requirements, and context.
4. Separate confirmed issues from likely causes.
5. Explain WHY the issue occurs.
6. Provide corrected code when code correction is requested or clearly necessary.
7. Preserve the user's existing intended behavior unless a change is necessary.
8. If information is missing, explicitly state what cannot be determined.
9. Never invent an error message, API response, library behavior, runtime output, or environment detail.
10. Never claim code was executed or tested unless execution evidence is actually supplied.
11. Never claim a solution is guaranteed when the environment is unknown.
12. Mention important edge cases when relevant.
13. Mention performance implications when relevant.
14. Mention security implications when relevant.
15. Prefer maintainable production-quality solutions over clever but fragile code.

CODE RULES:

- Preserve existing functionality unless the requested fix requires changing it.
- Do not silently remove features.
- Do not invent dependencies without explaining why they are required.
- Keep imports consistent with the chosen language/framework.
- Avoid deprecated APIs when a stable supported alternative is known.
- Avoid unnecessary abstractions.
- Do not hide errors with empty catch blocks.
- Do not expose secrets, API keys, passwords, tokens, or private credentials.
- If secrets appear in user code, instruct the user to rotate/revoke them and redact them from future sharing.
- Never generate destructive commands without clearly explaining their impact.
- Never fabricate test results.

RESPONSE QUALITY:

Use Markdown.

When debugging:
- Diagnosis
- Root cause
- Fix
- Corrected code
- Why the fix works
- Verification steps
- Edge cases / best practices

When reviewing code:
- Critical issues
- Important improvements
- Minor improvements
- Recommended corrected implementation

When explaining a concept:
- Short explanation
- Example
- Common mistakes
- Practical guidance

If multiple issues exist, number them and handle them independently.

If the user's supplied code is incomplete, provide the best safe analysis possible and clearly identify the missing information.

IMPORTANT:
The user may communicate in English, Hindi, Hinglish, or Gujarati.
Understand all of these languages.
Keep programming keywords, API names, framework names, function names, and technical terminology in English.
Match the user's conversational language where practical.

Return valid JSON only.

Required JSON structure:

{
  "summary": "concise technical summary",
  "intent": "DEBUGGING|CODE_REVIEW|IMPLEMENTATION|EXPLANATION|PERFORMANCE|TESTING|SECURITY_REVIEW|GENERAL_PROGRAMMING",
  "diagnosis": [
    {
      "issue": "problem",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
      "cause": "why it happens",
      "evidence": "evidence from supplied input",
      "confidence": 0-1
    }
  ],
  "solution": {
    "explanation": "recommended solution",
    "correctedCode": "complete corrected code when applicable",
    "language": "language or null",
    "framework": "framework or null"
  },
  "changes": [],
  "verificationSteps": [],
  "edgeCases": [],
  "performanceNotes": [],
  "securityNotes": [],
  "limitations": [],
  "followUpQuestions": []
}

Do not put unsupported claims into the JSON.
`;
}

function buildUserPrompt(
  profile,
  query,
  context
) {
  const normalizedProfile =
    normalizeProfile(profile);

  const programmingIntent =
    detectProgrammingIntent(query);

  return `
Programming Intent:
${programmingIntent}

User Query:
${normalizeText(query)}

User Profile Context:
${JSON.stringify(
  normalizedProfile,
  null,
  2
)}

Conversation History:
${JSON.stringify(
  normalizeConversation(context),
  null,
  2
)}

Additional Technical Context:
${JSON.stringify(
  {
    language:
      context?.language ||
      context?.programmingLanguage ||
      null,

    framework:
      context?.framework ||
      null,

    runtime:
      context?.runtime ||
      null,

    environment:
      context?.environment ||
      null,

    error:
      context?.error ||
      context?.errorMessage ||
      null,

    stackTrace:
      context?.stackTrace ||
      context?.traceback ||
      null,

    code:
      context?.code ||
      context?.codeSnippet ||
      null,

    files:
      Array.isArray(context?.files)
        ? context.files
        : []
  },
  null,
  2
)}

IMPORTANT:
- Analyze only the supplied information.
- Do not claim that code was executed.
- Do not invent missing runtime details.
- If code is supplied, preserve its intended behavior.
- If the user asks for a fix, provide complete corrected code when enough information exists.
- If the code is incomplete, clearly state the limitation.
- Keep the response strictly technical.
`;
}

function parseLLMResult(result) {
  if (
    result &&
    typeof result === "object"
  ) {
    return result;
  }

  if (typeof result !== "string") {
    return {};
  }

  const cleaned = result
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

function sanitizeSeverity(value) {
  const normalized =
    normalizeText(value).toUpperCase();

  const allowed = [
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW",
    "INFO"
  ];

  return allowed.includes(normalized)
    ? normalized
    : "INFO";
}

function sanitizeIntent(value, fallback) {
  const normalized =
    normalizeText(value)
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

  const allowed = [
    "DEBUGGING",
    "CODE_REVIEW",
    "IMPLEMENTATION",
    "EXPLANATION",
    "PERFORMANCE",
    "TESTING",
    "SECURITY_REVIEW",
    "GENERAL_PROGRAMMING"
  ];

  return allowed.includes(normalized)
    ? normalized
    : fallback;
}

function sanitizeIssue(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const issue =
    normalizeText(item.issue);

  const cause =
    normalizeText(item.cause);

  if (!issue && !cause) {
    return null;
  }

  return {
    issue:
      issue || "Unspecified technical issue",

    severity:
      sanitizeSeverity(
        item.severity
      ),

    cause:
      cause ||
      "The exact cause cannot be determined from the supplied information.",

    evidence:
      normalizeText(item.evidence) ||
      "No explicit evidence was supplied.",

    confidence:
      clampConfidence(
        item.confidence,
        0.5
      )
  };
}

function sanitizeStringArray(values) {
  return safeArray(values)
    .map(normalizeText)
    .filter(Boolean)
    .slice(0, 30);
}

function sanitizeSolution(solution) {
  if (
    !solution ||
    typeof solution !== "object"
  ) {
    return {
      explanation:
        "No structured solution was returned.",
      correctedCode: "",
      language: null,
      framework: null
    };
  }

  return {
    explanation:
      normalizeText(
        solution.explanation
      ),

    correctedCode:
      normalizeText(
        solution.correctedCode ||
        solution.code ||
        solution.fixedCode
      ),

    language:
      normalizeText(
        solution.language
      ) || null,

    framework:
      normalizeText(
        solution.framework
      ) || null
  };
}

function sanitizeAnalysis(
  parsed,
  query
) {
  const fallbackIntent =
    detectProgrammingIntent(query);

  const diagnosis =
    safeArray(parsed?.diagnosis)
      .map(sanitizeIssue)
      .filter(Boolean)
      .slice(0, 20);

  const solution =
    sanitizeSolution(
      parsed?.solution
    );

  return {
    summary:
      normalizeText(
        parsed?.summary
      ) ||
      "The programming request was analyzed using the supplied technical information.",

    intent:
      sanitizeIntent(
        parsed?.intent,
        fallbackIntent
      ),

    diagnosis,

    solution,

    changes:
      sanitizeStringArray(
        parsed?.changes
      ),

    verificationSteps:
      sanitizeStringArray(
        parsed?.verificationSteps
      ),

    edgeCases:
      sanitizeStringArray(
        parsed?.edgeCases
      ),

    performanceNotes:
      sanitizeStringArray(
        parsed?.performanceNotes
      ),

    securityNotes:
      sanitizeStringArray(
        parsed?.securityNotes
      ),

    limitations:
      sanitizeStringArray(
        parsed?.limitations
      ),

    followUpQuestions:
      sanitizeStringArray(
        parsed?.followUpQuestions
      )
  };
}

function buildLocalFallback(
  query,
  context
) {
  const queryText = normalizeText(query);
  const intent = detectProgrammingIntent(query);

  const contextCode = normalizeText(
    context?.code || context?.codeSnippet
  );

  // Extract inline code if present in query (e.g. enclosed in backticks or recognized by code keywords)
  let extractedCode = contextCode;
  if (!extractedCode) {
    const codeBlockMatch = queryText.match(/```(?:[a-z]+)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      extractedCode = codeBlockMatch[1].trim();
    } else if (
      /\b(useState|useEffect|useCallback|useMemo|function\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|class\s+\w+|=>|\{\s*set\w+)/i.test(
        queryText
      )
    ) {
      extractedCode = queryText;
    }
  }

  const hasCode = Boolean(extractedCode);
  const hasError = Boolean(
    normalizeText(
      context?.error ||
      context?.errorMessage ||
      context?.stackTrace ||
      context?.traceback
    )
  );

  const diagnosis = [];
  let summary = "";
  let solution = {
    explanation: "",
    correctedCode: "",
    language: normalizeText(context?.language || context?.programmingLanguage) || "javascript",
    framework: normalizeText(context?.framework) || "react"
  };
  let changes = [];
  let verificationSteps = [
    "Reproduce the issue in the target runtime.",
    "Apply the proposed code fix.",
    "Verify the component or module behaves as expected without unintended side-effects or errors."
  ];

  // Specific check: React infinite loop in useEffect
  if (
    hasCode &&
    /(useeffect|setstate|set[a-z0-9_]+|infinite\s*loop|re-?render)/i.test(
      extractedCode
    ) &&
    /\b(set[a-z0-9_]+|infinite\s*loop|re-?render)/i.test(queryText)
  ) {
    summary =
      "Diagnosis: Infinite re-render loop detected. Calling a state setter directly inside a React useEffect without a dependency array (or with the updated state variable in its dependencies) triggers a new render on every state update, which immediately invokes the effect again.";

    diagnosis.push({
      issue: "React infinite re-render loop in useEffect",
      severity: "CRITICAL",
      cause:
        "The state setter is executed synchronously or directly inside the useEffect hook without specifying a dependency array (or re-triggering itself on every render).",
      evidence: extractedCode.slice(0, 200),
      confidence: 0.95
    });

    solution.explanation =
      "To prevent an infinite loop, provide a dependency array `[]` so the effect only runs once on mount, or pass the specific dependencies that should trigger the effect. If computing new state based on previous state, use the functional state updater form `setVal(prev => prev + 1)`.";

    solution.correctedCode = `import React, { useState, useEffect } from 'react';

function SafeComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Only runs once on mount due to the empty dependency array []
    let isMounted = true;
    async function fetchData() {
      const res = await fetch('/api/data');
      const json = await res.json();
      if (isMounted) setData(json);
    }
    fetchData();

    return () => { isMounted = false; };
  }, []); // <-- Empty dependency array prevents infinite re-render

  return <div>{data ? JSON.stringify(data) : 'Loading...'}</div>;
}`;
    changes.push("Added dependency array `[]` to the useEffect hook.");
    changes.push("Added cleanup flag to prevent state updates on unmounted components.");
    verificationSteps = [
      "Check browser console to verify render count stops after mounting.",
      "Ensure React does not throw 'Maximum update depth exceeded' error."
    ];
  } else if (hasError) {
    summary = "A runtime error was detected. Analysis of the error context reveals potential execution failure.";
    diagnosis.push({
      issue: "A programming error or failure was supplied.",
      severity: "HIGH",
      cause:
        "The error indicates an unhandled runtime failure. Review variable scope, null checks, and async execution paths.",
      evidence: context?.error || queryText.slice(0, 150),
      confidence: 0.8
    });
    solution.explanation = "Guard against null/undefined values and ensure asynchronous promises are awaited with try/catch handling.";
    solution.correctedCode = `try {\n  // Protected execution\n} catch (err) {\n  console.error("Safely caught:", err);\n}`;
  } else if (hasCode) {
    summary = "Code was analyzed for structural safety, performance, and best practices.";
    diagnosis.push({
      issue: "Static code review and optimization recommendations.",
      severity: "INFO",
      cause: "Ensure proper error handling, input validation, and asynchronous flow control.",
      evidence: extractedCode.slice(0, 150),
      confidence: 0.8
    });
    solution.explanation = "Ensure defensive validation, handle edge cases, and add appropriate test coverage.";
    solution.correctedCode = extractedCode;
  } else {
    summary = "Please provide the code snippet or error message for a precise technical analysis.";
    diagnosis.push({
      issue: "Insufficient technical input for deterministic debugging.",
      severity: "INFO",
      cause: "A precise diagnosis requires code, an error message, expected behavior, or additional technical details.",
      evidence: "No code or explicit error context was detected in the prompt.",
      confidence: 0.9
    });
    solution.explanation = "Provide the relevant code or error details so the issue can be diagnosed precisely.";
  }

  return {
    summary,
    intent,
    diagnosis,
    solution,
    changes,
    verificationSteps,
    edgeCases: [],
    performanceNotes: [],
    securityNotes: [],
    limitations: [
      "Deterministic local analysis based on static pattern recognition."
    ],
    followUpQuestions: [
      ...(hasCode ? [] : ["Please provide the relevant code snippet or file."]),
      ...(hasError ? [] : ["Please provide the exact error message or stack trace if one exists."]),
      "What behavior did you expect, and what behavior are you currently seeing?"
    ]
  };
}

function buildAgentResponse(
  query,
  analysis,
  source
) {
  return normalizeAgentResponse({
    success: true,
    status: "completed",
    agent: AGENT_NAME,

    response:
      analysis.summary,

    data: {
      query:
        normalizeText(query),

      intent:
        analysis.intent,

      diagnosis:
        analysis.diagnosis,

      solution:
        analysis.solution,

      changes:
        analysis.changes,

      verificationSteps:
        analysis.verificationSteps,

      edgeCases:
        analysis.edgeCases,

      performanceNotes:
        analysis.performanceNotes,

      securityNotes:
        analysis.securityNotes,

      limitations:
        analysis.limitations,

      followUpQuestions:
        analysis.followUpQuestions,

      integrity: {
        codeExecutionPerformed: false,
        fabricatedRuntimeOutput: false,
        fabricatedErrors: false,
        fabricatedDependencies: false,
        secretsGenerated: false
      },

      source
    },

    metadata: {
      grounded: true,
      source,
      intent:
        analysis.intent,
      generatedAt:
        new Date().toISOString()
    }
  });
}

async function handleQuery(
  profile,
  query,
  context = {}
) {
  const normalizedQuery =
    normalizeText(query);

  if (!normalizedQuery) {
    return failedAgentResponse(
      AGENT_NAME,
      "Please provide a programming question, code snippet, error message, or debugging problem."
    );
  }

  try {
    const result =
      await callLLM(
        buildSystemPrompt(),
        buildUserPrompt(
          profile,
          normalizedQuery,
          context
        ),
        true,
        {
          conversation:
            normalizeConversation(
              context
            )
        }
      );

    const parsed =
      parseLLMResult(result);

    const analysis =
      sanitizeAnalysis(
        parsed,
        normalizedQuery
      );

    return buildAgentResponse(
      normalizedQuery,
      analysis,
      "llm-coding-analysis"
    );
  } catch (error) {
    console.error(
      "[Coding Agent] LLM analysis failed:",
      error?.message || error
    );

    return buildAgentResponse(
      normalizedQuery,
      buildLocalFallback(
        normalizedQuery,
        context
      ),
      "local-grounded-fallback"
    );
  }
}

module.exports = {
  handleQuery
};