/**
 * HireVision AI - Professional AI Core / OpenAI Service
 *
 * Responsibilities:
 * - Centralized OpenAI Responses API integration
 * - Conversation/context normalization
 * - Structured JSON output
 * - Optional strict JSON Schema output
 * - Tool/function calling foundation
 * - Retry and transient error handling
 * - Model fallback
 * - Request timeout protection
 * - Language handling
 * - Safe response extraction
 * - Response metadata
 *
 * IMPORTANT:
 * This service intentionally does NOT fabricate candidate, profile,
 * GitHub, LinkedIn, recruiter, analytics, or career data when OpenAI
 * is unavailable. Data-producing agents must fail transparently so
 * higher-level agents can handle the failure correctly.
 */

function getOpenAIApiKey() {
  return (process.env.OPENAI_API_KEY || "").trim();
}

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim();
}

function getGroqApiKey() {
  return (process.env.GROQ_API_KEY || "").trim();
}

function getOpenRouterApiKey() {
  return (process.env.OPENROUTER_API_KEY || "").trim();
}

function getActiveProviders() {
  const providers = [];
  const openAiKey = getOpenAIApiKey();
  const geminiKey = getGeminiApiKey();
  const groqKey = getGroqApiKey();
  const openRouterKey = getOpenRouterApiKey();
  const preferredProvider = String(process.env.AI_PROVIDER || "").toLowerCase().trim();

  const geminiProvider = geminiKey
    ? {
        id: "gemini",
        name: "Google Gemini",
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        apiKey: geminiKey,
        models: [
          process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
          "gemini-3.8-flash",
          "gemini-3.5-flash",
        ],
      }
    : null;

  const openaiProvider = openAiKey && !openAiKey.startsWith("AIzaSy")
    ? {
        id: "openai",
        name: "OpenAI",
        url:
          process.env.OPENAI_CHAT_COMPLETIONS_API_URL ||
          (process.env.OPENAI_BASE_URL
            ? `${process.env.OPENAI_BASE_URL.replace(/\/+$/, "")}/chat/completions`
            : "https://api.openai.com/v1/chat/completions"),
        apiKey: openAiKey,
        models: [
          process.env.OPENAI_MODEL || "gpt-4o",
          process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini",
        ],
      }
    : null;

  if (preferredProvider === "gemini" && geminiProvider) {
    providers.push(geminiProvider);
    if (openaiProvider) providers.push(openaiProvider);
  } else {
    if (openaiProvider) providers.push(openaiProvider);
    if (geminiProvider) providers.push(geminiProvider);
  }

  // 3. Groq
  if (groqKey) {
    providers.push({
      id: "groq",
      name: "Groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: groqKey,
      models: [
        process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      ],
    });
  }

  // 4. OpenRouter
  if (openRouterKey) {
    providers.push({
      id: "openrouter",
      name: "OpenRouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: openRouterKey,
      models: [
        process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-exp:free",
      ],
    });
  }

  return providers;
}

const OPENAI_API_MODE =
  String(process.env.OPENAI_API_MODE || "chat_completions")
    .trim()
    .toLowerCase();

const OPENAI_RESPONSES_API_URL =
  process.env.OPENAI_RESPONSES_API_URL ||
  "https://api.openai.com/v1/responses";

const OPENAI_CHAT_COMPLETIONS_API_URL =
  process.env.OPENAI_CHAT_COMPLETIONS_API_URL ||
  "https://api.openai.com/v1/chat/completions";

const DEFAULT_MAX_OUTPUT_TOKENS = Number(
  process.env.OPENAI_MAX_OUTPUT_TOKENS ||
    process.env.OPENAI_MAX_TOKENS ||
    4000
);

const REQUEST_TIMEOUT = Number(
  process.env.OPENAI_TIMEOUT_MS || 60000
);

const MAX_RETRIES = Math.max(
  0,
  Number(process.env.OPENAI_MAX_RETRIES || 2)
);

const MAX_CONVERSATION_MESSAGES = Math.max(
  4,
  Number(process.env.OPENAI_MAX_CONVERSATION_MESSAGES || 30)
);

const MAX_CONTEXT_CHARS = Math.max(
  10000,
  Number(process.env.OPENAI_MAX_CONTEXT_CHARS || 120000)
);

const ENABLE_MODEL_FALLBACK =
  String(process.env.OPENAI_ENABLE_MODEL_FALLBACK || "true")
    .toLowerCase() !== "false";

const ENABLE_REQUEST_LOGGING =
  String(process.env.OPENAI_ENABLE_REQUEST_LOGGING || "true")
    .toLowerCase() !== "false";

const DEFAULT_REASONING_EFFORT =
  process.env.OPENAI_REASONING_EFFORT || "medium";

const DEFAULT_VERBOSITY =
  process.env.OPENAI_VERBOSITY || "medium";

const getPrimaryModel = () => process.env.OPENAI_MODEL || "gpt-4o";
const getFallbackModel = () => process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini";
const OPENAI_MODEL = getPrimaryModel();
const OPENAI_FALLBACK_MODEL = getFallbackModel();

/* =========================================================================
   LANGUAGE
   ========================================================================= */

function normalizeLanguage(language) {
  if (!language) return "auto";

  const value = String(language)
    .trim()
    .toLowerCase();

  if (
    value === "hi" ||
    value === "hindi" ||
    value.startsWith("hi-")
  ) {
    return "hi";
  }

  if (
    value === "gu" ||
    value === "gujarati" ||
    value.startsWith("gu-")
  ) {
    return "gu";
  }

  if (
    value === "en" ||
    value === "english" ||
    value.startsWith("en-")
  ) {
    return "en";
  }

  return "auto";
}

function getLanguageInstruction(language) {
  const normalized = normalizeLanguage(language);

  if (normalized === "hi") {
    return `
LANGUAGE REQUIREMENT:
Respond in natural professional Hindi/Hinglish.

Use English for technical terminology where appropriate:
React, JavaScript, TypeScript, Node.js, API, SQL, GitHub,
ATS, resume, interview, frontend, backend, Docker,
AWS, PostgreSQL, MongoDB, REST, GraphQL.

Do not translate technical names unnecessarily.
`;
  }

  if (normalized === "gu") {
    return `
LANGUAGE REQUIREMENT:
Respond in natural professional Gujarati.

Use English for technical terminology where appropriate:
React, JavaScript, TypeScript, Node.js, API, SQL, GitHub,
ATS, resume, interview, frontend, backend, Docker,
AWS, PostgreSQL, MongoDB, REST, GraphQL.

Do not translate technical names unnecessarily.
`;
  }

  if (normalized === "en") {
    return `
LANGUAGE REQUIREMENT:
Respond in clear, natural, professional English.
`;
  }

  return `
LANGUAGE REQUIREMENT:
Detect the language of the user's latest meaningful question.

If the user writes Hindi/Hinglish, respond naturally in Hindi/Hinglish.
If the user writes Gujarati, respond naturally in Gujarati.
Otherwise use professional English.

Keep technical terminology in its standard English form.
`;
}

/* =========================================================================
   GLOBAL HIREVISION SYSTEM PROMPT
   ========================================================================= */

const DEFAULT_CHAT_SYSTEM_PROMPT = `
You are HireVision AI, a professional Career, Recruitment,
Software Engineering, and AI Copilot.

You are not a generic chatbot.

Your responsibilities include:

1. Candidate Profile Intelligence
2. Skill Intelligence
3. Project Analysis
4. Career Guidance
5. Skill Gap Analysis
6. Career Readiness
7. Resume and ATS Optimization
8. GitHub and LinkedIn Evidence Analysis
9. Coding and Debugging
10. Technical Teaching
11. Interview Preparation
12. Recruiter Candidate Discovery
13. Candidate-Job Matching
14. Candidate Ranking
15. Candidate Comparison
16. Candidate Shortlisting
17. Hiring Pipeline Intelligence
18. Recruiter Analytics
19. Talent Pool Intelligence
20. Candidate Re-engagement

CORE BEHAVIOR:

- Be accurate.
- Be evidence-driven.
- Never invent candidate facts.
- Never invent recruiter metrics.
- Never fabricate GitHub activity.
- Never fabricate LinkedIn information.
- Never claim that an external source was checked unless the system
  actually supplied that evidence.
- Clearly distinguish:
  1. user-provided information,
  2. database information,
  3. verified external evidence,
  4. AI inference,
  5. recommendation.
- If information is missing, explicitly say that it is missing.
- If evidence is insufficient, lower confidence rather than guessing.
- Do not manufacture percentages simply to make an answer look precise.
- Do not claim that a candidate is qualified solely because of an
  unverified skill declaration.
- For recruiting decisions, provide reasoning and evidence.
- For candidate recommendations, explain both strengths and gaps.
- Prefer actionable recommendations over generic advice.
- Maintain conversation context.
- Respect the user's latest instruction.
- Do not repeat information unnecessarily.
- When appropriate, ask a focused clarification question rather than
  making unsupported assumptions.

QUALITY STANDARD:

Every professional analysis should aim to contain:

- conclusion
- evidence
- reasoning
- confidence
- limitations
- actionable next steps

When a requested output has a defined JSON schema, return only the
requested JSON structure.
`;

/* =========================================================================
   PUBLIC LLM ENTRY POINT
   ========================================================================= */

/**
 * Main backwards-compatible entry point.
 *
 * Existing agents can continue using:
 *
 * await callLLM(systemPrompt, userPrompt, true, options)
 *
 * without modification.
 */
async function callLLM(
  systemPrompt,
  userPrompt,
  jsonMode = false,
  options = {}
) {
  const result = await callLLMResponse(
    systemPrompt,
    userPrompt,
    {
      ...options,
      jsonMode
    }
  );

  if (jsonMode) {
    return result.parsed;
  }

  return result.text;
}

/* =========================================================================
   FULL RESPONSE API
   ========================================================================= */

/**
 * Returns both text and response metadata.
 *
 * This will be useful for future observability, evaluations,
 * token tracking, trace IDs, and agent orchestration.
 */
async function callLLMResponse(
  systemPrompt,
  userPrompt,
  options = {}
) {
  validateConfiguration();

  const providers = getActiveProviders();
  const normalizedOptions = normalizeLLMOptions(
    systemPrompt,
    userPrompt,
    options
  );

  let lastError = null;

  for (let pIdx = 0; pIdx < providers.length; pIdx++) {
    const provider = providers[pIdx];
    const candidateModels = [
      ...(normalizedOptions.model && provider.id === "openai" ? [normalizedOptions.model] : []),
      ...provider.models,
    ];
    const modelsToTry = [...new Set(candidateModels.filter(Boolean))];

    for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
      const model = modelsToTry[attempt];

      try {
        const result =
          OPENAI_API_MODE === "chat_completions" || provider.id !== "openai"
            ? await callChatCompletionsAPI(
                normalizedOptions,
                model,
                provider
              )
            : await callResponsesAPI(
                normalizedOptions,
                model,
                provider
              );

        if (!result) {
          throw new Error(
            `${provider.name} returned an empty response.`
          );
        }

        return result;
      } catch (error) {
        lastError = normalizeOpenAIError(error);

        logAPIError({
          error: lastError,
          provider: provider.name,
          model,
          attempt: attempt + 1,
          totalAttempts: modelsToTry.length
        });

        const isQuotaOrCredit =
          lastError?.code === "credit_balance_exhausted" ||
          lastError?.code === "insufficient_quota" ||
          (lastError?.status === 429 &&
            String(lastError?.message || "").toLowerCase().includes("credit"));

        if (isQuotaOrCredit && pIdx < providers.length - 1) {
          console.warn(
            `[HireVision AI] ${provider.name} credits exhausted. Falling back to next available provider (${providers[pIdx + 1].name})...`
          );
          break;
        }

        const canRetry =
          shouldRetryError(lastError) &&
          attempt < modelsToTry.length - 1;

        if (!canRetry) {
          break;
        }

        await sleep(
          calculateRetryDelay(attempt, lastError)
        );
      }
    }
  }

  if (
    lastError?.code === "credit_balance_exhausted" ||
    String(lastError?.message || "").toLowerCase().includes("credit")
  ) {
    throw new Error(
      "OpenAI API credit balance is exhausted. Please add credits at https://platform.openai.com/settings/organization/billing or configure an active GEMINI_API_KEY in backend/.env."
    );
  }

  throw lastError || new Error(
    "HireVision AI request failed."
  );
}

/* =========================================================================
   RESPONSES API
   ========================================================================= */

async function callResponsesAPI(
  options,
  model
) {
  const input = buildResponsesInput(
    options.conversation,
    options.userPrompt
  );

  const payload = {
    model,
    instructions: options.systemPrompt,
    input,
    max_output_tokens: options.maxOutputTokens,
    store: options.store,
    truncation: options.truncation
  };

  if (options.previousResponseId) {
    payload.previous_response_id =
      options.previousResponseId;
  }

  if (options.reasoningEffort && isReasoningModel(model)) {
    payload.reasoning = {
      effort: options.reasoningEffort
    };
  }

  if (
    options.verbosity &&
    supportsVerbosity(model)
  ) {
    payload.text = {
      ...(payload.text || {}),
      verbosity: options.verbosity
    };
  }

  if (
    options.temperature !== undefined &&
    supportsTemperature(model)
  ) {
    payload.temperature = options.temperature;
  }

  if (options.tools?.length) {
    payload.tools = options.tools;
    payload.tool_choice =
      options.toolChoice || "auto";
  }

  if (options.metadata) {
    payload.metadata = sanitizeMetadata(
      options.metadata
    );
  }

  if (options.jsonSchema) {
    payload.text = {
      ...(payload.text || {}),
      format: {
        type: "json_schema",
        name:
          options.jsonSchema.name ||
          "hirevision_response",
        description:
          options.jsonSchema.description ||
          "Structured HireVision AI response.",
        strict:
          options.jsonSchema.strict !== false,
        schema:
          options.jsonSchema.schema
      }
    };
  } else if (options.jsonMode) {
    payload.text = {
      ...(payload.text || {}),
      format: {
        type: "json_object"
      }
    };
  }

  const requestId = createRequestId();

  if (ENABLE_REQUEST_LOGGING) {
    console.info(
      `[HireVision AI] Responses API request ${requestId} | model=${model}`
    );
  }

  const response = await fetchWithTimeout(
    OPENAI_RESPONSES_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "X-Client-Request-Id": requestId
      },
      body: JSON.stringify(payload)
    },
    options.timeout
  );

  const data =
    await parseResponseBody(response);

  if (!response.ok) {
    throw createAPIError(
      response,
      data,
      requestId
    );
  }

  return normalizeResponsesResult(
    data,
    {
      requestId,
      model
    }
  );
}

/* =========================================================================
   CHAT COMPLETIONS COMPATIBILITY API
   ========================================================================= */

async function callChatCompletionsAPI(
  options,
  model,
  provider = null
) {
  const messages = [
    {
      role: "system",
      content: options.systemPrompt
    },
    ...options.conversation,
    {
      role: "user",
      content: options.userPrompt
    }
  ];

  const payload = {
    model,
    messages,
    max_tokens: options.maxOutputTokens,
    temperature:
      options.temperature ?? 0.7
  };

  if (options.jsonSchema) {
    payload.response_format = {
      type: "json_schema",
      json_schema: {
        name:
          options.jsonSchema.name ||
          "hirevision_response",
        description:
          options.jsonSchema.description ||
          "Structured HireVision AI response.",
        strict:
          options.jsonSchema.strict !== false,
        schema:
          options.jsonSchema.schema
      }
    };
  } else if (options.jsonMode) {
    payload.response_format = {
      type: "json_object"
    };
  }

  if (options.tools?.length) {
    payload.tools = options.tools;
    payload.tool_choice =
      options.toolChoice || "auto";
  }

  const requestId = createRequestId();
  const targetUrl =
    provider?.url ||
    process.env.OPENAI_CHAT_COMPLETIONS_API_URL ||
    "https://api.openai.com/v1/chat/completions";
  const targetKey = provider?.apiKey || getOpenAIApiKey();

  const response = await fetchWithTimeout(
    targetUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${targetKey}`,
        "X-Client-Request-Id": requestId
      },
      body: JSON.stringify(payload)
    },
    options.timeout
  );

  const data =
    await parseResponseBody(response);

  if (!response.ok) {
    throw createAPIError(
      response,
      data,
      requestId
    );
  }

  return normalizeChatCompletionResult(
    data,
    {
      requestId,
      model
    }
  );
}

/* =========================================================================
   OPTIONAL TOOL-CALLING FOUNDATION
   ========================================================================= */

/**
 * Generic tool-enabled agent execution.
 *
 * This does not force every current agent to become tool-enabled at once.
 * Future specialist agents can pass:
 *
 * tools: [...]
 * toolHandlers: {
 *   getCandidate: async (args) => {...}
 * }
 *
 * The model can request a function and this service executes it,
 * sends the result back to the model, and continues until a final
 * text response is produced.
 */
async function callLLMWithTools(
  systemPrompt,
  userPrompt,
  options = {}
) {
  validateConfiguration();

  if (!Array.isArray(options.tools) || options.tools.length === 0) {
    throw new Error(
      "callLLMWithTools requires at least one tool definition."
    );
  }

  if (
    !options.toolHandlers ||
    typeof options.toolHandlers !== "object"
  ) {
    throw new Error(
      "callLLMWithTools requires toolHandlers."
    );
  }

  const maxToolRounds = Math.min(
    10,
    Math.max(
      1,
      Number(options.maxToolRounds || 5)
    )
  );

  let conversation =
    normalizeConversation(
      options.conversation ||
        options.history ||
        []
    );

  let currentInput = [
    ...conversation,
    {
      role: "user",
      content: String(userPrompt || "").trim()
    }
  ];

  let previousResponseId =
    options.previousResponseId || null;

  for (
    let round = 0;
    round < maxToolRounds;
    round++
  ) {
    const result = await callLLMResponse(
      systemPrompt,
      String(userPrompt || "").trim(),
      {
        ...options,
        conversation,
        tools: options.tools,
        previousResponseId,
        jsonMode: false
      }
    );

    previousResponseId =
      result.responseId ||
      previousResponseId;

    if (
      !Array.isArray(result.toolCalls) ||
      result.toolCalls.length === 0
    ) {
      return result.text;
    }

    const toolOutputs = [];

    for (const toolCall of result.toolCalls) {
      const handler =
        options.toolHandlers[
          toolCall.name
        ];

      if (typeof handler !== "function") {
        toolOutputs.push({
          call_id: toolCall.callId,
          output: JSON.stringify({
            error:
              `No handler registered for tool "${toolCall.name}".`
          })
        });

        continue;
      }

      let parsedArguments = {};

      try {
        parsedArguments =
          typeof toolCall.arguments === "string"
            ? JSON.parse(toolCall.arguments)
            : toolCall.arguments || {};
      } catch {
        parsedArguments = {};
      }

      try {
        const toolResult =
          await handler(
            parsedArguments,
            {
              toolCall,
              round,
              requestId: result.requestId
            }
          );

        toolOutputs.push({
          call_id: toolCall.callId,
          output: safeSerializeToolOutput(
            toolResult
          )
        });
      } catch (error) {
        toolOutputs.push({
          call_id: toolCall.callId,
          output: JSON.stringify({
            error:
              error?.message ||
              "Tool execution failed."
          })
        });
      }
    }

    /**
     * Responses API requires tool outputs to be sent as input
     * items associated with the previous response.
     */
    if (
      OPENAI_API_MODE === "responses" &&
      previousResponseId
    ) {
      return await continueResponsesToolConversation(
        systemPrompt,
        toolOutputs,
        previousResponseId,
        options
      );
    }

    /**
     * Compatibility path for chat-completions mode.
     */
    conversation = [
      ...conversation,
      {
        role: "assistant",
        content: result.text || ""
      }
    ];

    for (const output of toolOutputs) {
      conversation.push({
        role: "user",
        content:
          `Tool result (${output.call_id}):\n${output.output}`
      });
    }

    currentInput = conversation;
  }

  throw new Error(
    "HireVision AI exceeded the maximum tool execution rounds."
  );
}

async function continueResponsesToolConversation(
  systemPrompt,
  toolOutputs,
  previousResponseId,
  options
) {
  const requestId = createRequestId();

  const payload = {
    model:
      options.model || OPENAI_MODEL,
    instructions: systemPrompt,
    previous_response_id:
      previousResponseId,
    input: toolOutputs.map(item => ({
      type: "function_call_output",
      call_id: item.call_id,
      output: item.output
    })),
    max_output_tokens:
      options.maxOutputTokens ||
      DEFAULT_MAX_OUTPUT_TOKENS,
    store:
      options.store !== false
  };

  if (options.reasoningEffort) {
    payload.reasoning = {
      effort: options.reasoningEffort
    };
  }

  const response = await fetchWithTimeout(
    OPENAI_RESPONSES_API_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "X-Client-Request-Id": requestId
      },
      body: JSON.stringify(payload)
    },
    options.timeout ||
      REQUEST_TIMEOUT
  );

  const data =
    await parseResponseBody(response);

  if (!response.ok) {
    throw createAPIError(
      response,
      data,
      requestId
    );
  }

  const result =
    normalizeResponsesResult(data, {
      requestId,
      model:
        options.model || OPENAI_MODEL
    });

  if (
    Array.isArray(result.toolCalls) &&
    result.toolCalls.length > 0
  ) {
    throw new Error(
      "Additional tool rounds are required. Use callLLMWithTools for multi-round tool execution."
    );
  }

  return result.text;
}

/* =========================================================================
   NORMALIZATION
   ========================================================================= */

function normalizeLLMOptions(
  systemPrompt,
  userPrompt,
  options = {}
) {
  const conversation =
    normalizeConversation(
      options.conversation ||
        options.history ||
        []
    );

  return {
    systemPrompt:
      buildSystemPrompt(
        systemPrompt,
        options
      ),

    userPrompt:
      String(userPrompt || "").trim(),

    conversation,

    model:
      options.model ||
      OPENAI_MODEL,

    fallbackModel:
      options.fallbackModel ||
      OPENAI_FALLBACK_MODEL,

    jsonMode:
      Boolean(options.jsonMode),

    jsonSchema:
      options.jsonSchema || null,

    temperature:
      normalizeTemperature(
        options.temperature
      ),

    maxOutputTokens:
      normalizePositiveNumber(
        options.maxTokens ??
          options.maxOutputTokens ??
          DEFAULT_MAX_OUTPUT_TOKENS,
        DEFAULT_MAX_OUTPUT_TOKENS
      ),

    timeout:
      normalizePositiveNumber(
        options.timeout ||
          REQUEST_TIMEOUT,
        REQUEST_TIMEOUT
      ),

    reasoningEffort:
      normalizeReasoningEffort(
        options.reasoningEffort ||
          DEFAULT_REASONING_EFFORT
      ),

    verbosity:
      normalizeVerbosity(
        options.verbosity ||
          DEFAULT_VERBOSITY
      ),

    previousResponseId:
      options.previousResponseId ||
      null,

    store:
      options.store !== false,

    truncation:
      options.truncation ||
      "auto",

    tools:
      Array.isArray(options.tools)
        ? options.tools
        : [],

    toolChoice:
      options.toolChoice || "auto",

    metadata:
      options.metadata || null
  };
}

function buildSystemPrompt(
  systemPrompt,
  options
) {
  const base =
    String(
      systemPrompt ||
        DEFAULT_CHAT_SYSTEM_PROMPT
    ).trim();

  const language =
    getLanguageInstruction(
      options.language
    );

  const additional =
    options.additionalInstructions
      ? `

ADDITIONAL AGENT INSTRUCTIONS:
${String(
  options.additionalInstructions
).trim()}`
      : "";

  return `${base}

${language}
${additional}`.trim();
}

function buildResponsesInput(
  conversation,
  userPrompt
) {
  const input = [];

  for (const message of conversation) {
    input.push({
      role:
        message.role === "assistant"
          ? "assistant"
          : "user",
      content: message.content
    });
  }

  if (userPrompt) {
    input.push({
      role: "user",
      content: userPrompt
    });
  }

  return limitInputSize(input);
}

function normalizeConversation(
  conversation
) {
  if (!Array.isArray(conversation)) {
    return [];
  }

  const normalized =
    conversation
      .filter(message => {
        if (!message) return false;

        const role =
          message.role;

        const content =
          message.content;

        return (
          (
            role === "user" ||
            role === "assistant"
          ) &&
          typeof content === "string" &&
          content.trim()
        );
      })
      .slice(-MAX_CONVERSATION_MESSAGES)
      .map(message => ({
        role: message.role,
        content: message.content
          .trim()
      }));

  return limitConversationSize(
    normalized
  );
}

function limitConversationSize(
  conversation
) {
  let total =
    conversation.reduce(
      (sum, message) =>
        sum +
        message.content.length,
      0
    );

  if (
    total <= MAX_CONTEXT_CHARS
  ) {
    return conversation;
  }

  const result = [];

  for (
    let i = conversation.length - 1;
    i >= 0;
    i--
  ) {
    const message =
      conversation[i];

    if (
      total >
      MAX_CONTEXT_CHARS
    ) {
      total -=
        message.content.length;
      continue;
    }

    result.unshift(message);
  }

  return result;
}

function limitInputSize(input) {
  let serialized =
    JSON.stringify(input);

  if (
    serialized.length <=
    MAX_CONTEXT_CHARS
  ) {
    return input;
  }

  const trimmed = [];
  let size = 0;

  for (
    let i = input.length - 1;
    i >= 0;
    i--
  ) {
    const item = input[i];
    const itemSize =
      JSON.stringify(item)
        .length;

    if (
      size + itemSize >
      MAX_CONTEXT_CHARS
    ) {
      break;
    }

    trimmed.unshift(item);
    size += itemSize;
  }

  return trimmed;
}

/* =========================================================================
   RESPONSE EXTRACTION
   ========================================================================= */

function normalizeResponsesResult(
  data,
  metadata = {}
) {
  const text =
    extractResponsesText(data);

  const toolCalls =
    extractResponsesToolCalls(data);

  const parsed =
    text
      ? tryParseStructuredJSON(text)
      : null;

  return {
    text:
      cleanTextResponse(text),

    parsed,

    toolCalls,

    responseId:
      data?.id || null,

    model:
      data?.model ||
      metadata.model ||
      null,

    requestId:
      metadata.requestId || null,

    usage:
      data?.usage || null,

    raw:
      data
  };
}

function normalizeChatCompletionResult(
  data,
  metadata = {}
) {
  const message =
    data?.choices?.[0]?.message;

  const text =
    extractChatCompletionContent(
      message
    );

  const toolCalls =
    Array.isArray(
      message?.tool_calls
    )
      ? message.tool_calls.map(
          tool => ({
            callId:
              tool.id,
            name:
              tool.function?.name,
            arguments:
              tool.function?.arguments ||
              "{}"
          })
        )
      : [];

  const parsed =
    text
      ? tryParseStructuredJSON(text)
      : null;

  return {
    text:
      cleanTextResponse(text),

    parsed,

    toolCalls,

    responseId:
      data?.id || null,

    model:
      data?.model ||
      metadata.model ||
      null,

    requestId:
      metadata.requestId || null,

    usage:
      data?.usage || null,

    raw:
      data
  };
}

function extractResponsesText(
  data
) {
  if (
    typeof data?.output_text ===
    "string"
  ) {
    return data.output_text;
  }

  const chunks = [];

  if (
    Array.isArray(data?.output)
  ) {
    for (
      const item of data.output
    ) {
      if (
        item?.type !== "message" ||
        !Array.isArray(
          item.content
        )
      ) {
        continue;
      }

      for (
        const content of item.content
      ) {
        if (
          content?.type ===
            "output_text" &&
          typeof content.text ===
            "string"
        ) {
          chunks.push(
            content.text
          );
        }
      }
    }
  }

  return chunks.join("");
}

function extractResponsesToolCalls(
  data
) {
  if (
    !Array.isArray(data?.output)
  ) {
    return [];
  }

  return data.output
    .filter(
      item =>
        item?.type ===
        "function_call"
    )
    .map(item => ({
      callId:
        item.call_id ||
        item.id ||
        null,

      name:
        item.name ||
        null,

      arguments:
        item.arguments ||
        "{}"
    }));
}

function extractChatCompletionContent(
  message
) {
  if (
    typeof message?.content ===
    "string"
  ) {
    return message.content;
  }

  if (
    Array.isArray(message?.content)
  ) {
    return message.content
      .map(item =>
        typeof item?.text ===
        "string"
          ? item.text
          : ""
      )
      .join("");
  }

  return "";
}

/* =========================================================================
   JSON HANDLING
   ========================================================================= */

function parseJsonResponse(
  content
) {
  const parsed =
    tryParseStructuredJSON(
      content
    );

  if (
    parsed === null ||
    typeof parsed !== "object"
  ) {
    throw new Error(
      "Invalid JSON response returned by AI."
    );
  }

  return parsed;
}

function tryParseStructuredJSON(
  content
) {
  const text =
    String(content || "")
      .trim();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {}

  const cleaned =
    text
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  /**
   * Some models may accidentally wrap JSON with explanatory text.
   * Only attempt extraction when the content contains an obvious
   * JSON object or array.
   */
  const firstObject =
    cleaned.indexOf("{");

  const lastObject =
    cleaned.lastIndexOf("}");

  if (
    firstObject >= 0 &&
    lastObject > firstObject
  ) {
    try {
      return JSON.parse(
        cleaned.slice(
          firstObject,
          lastObject + 1
        )
      );
    } catch {}
  }

  const firstArray =
    cleaned.indexOf("[");

  const lastArray =
    cleaned.lastIndexOf("]");

  if (
    firstArray >= 0 &&
    lastArray > firstArray
  ) {
    try {
      return JSON.parse(
        cleaned.slice(
          firstArray,
          lastArray + 1
        )
      );
    } catch {}
  }

  return null;
}

function cleanTextResponse(
  content
) {
  return String(
    content || ""
  )
    .replace(/\r\n/g, "\n")
    .trim();
}

/* =========================================================================
   REQUEST / ERROR MANAGEMENT
   ========================================================================= */

function validateConfiguration() {
  const providers = getActiveProviders();
  if (!providers.length) {
    throw new Error(
      "No AI provider API key is configured. Please configure an active OPENAI_API_KEY (with credits) or a free GEMINI_API_KEY in backend/.env."
    );
  }
}

async function parseResponseBody(
  response
) {
  try {
    return await response.json();
  } catch {
    const text =
      await response.text().catch(
        () => ""
      );

    return {
      error: {
        message:
          text ||
          "OpenAI returned an unreadable response."
      }
    };
  }
}

function createAPIError(
  response,
  data,
  requestId
) {
  const error =
    new Error(
      data?.error?.message ||
      data?.message ||
      `AI API request failed with status ${response.status}.`
    );

  error.name =
    "OpenAIAPIError";

  error.status =
    response.status;

  error.code =
    data?.error?.code ||
    data?.code ||
    null;

  error.type =
    data?.error?.type ||
    null;

  error.requestId =
    requestId;

  error.retryAfter =
    response.headers?.get?.(
      "retry-after"
    ) || null;

  return error;
}

function normalizeOpenAIError(
  error
) {
  if (
    error instanceof Error
  ) {
    return error;
  }

  return new Error(
    typeof error === "string"
      ? error
      : "Unknown OpenAI API error."
  );
}

function shouldRetryError(
  error
) {
  if (
    error?.code === "credit_balance_exhausted" ||
    error?.code === "insufficient_quota" ||
    error?.code === "invalid_api_key" ||
    String(error?.message || "").toLowerCase().includes("credit") ||
    String(error?.message || "").toLowerCase().includes("billing") ||
    String(error?.message || "").toLowerCase().includes("quota")
  ) {
    return false;
  }

  const status =
    Number(error?.status || 0);

  if (
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status >= 500
  ) {
    return true;
  }

  const message =
    String(
      error?.message || ""
    ).toLowerCase();

  return (
    message.includes(
      "timed out"
    ) ||
    message.includes(
      "timeout"
    ) ||
    message.includes(
      "temporarily unavailable"
    ) ||
    message.includes(
      "network"
    ) ||
    message.includes(
      "fetch failed"
    )
  );
}

function calculateRetryDelay(
  attempt,
  error
) {
  const retryAfter =
    Number(
      error?.retryAfter
    );

  if (
    Number.isFinite(
      retryAfter
    ) &&
    retryAfter > 0
  ) {
    return Math.min(
      retryAfter * 1000,
      15000
    );
  }

  const base =
    Math.pow(
      2,
      attempt
    ) * 500;

  const jitter =
    Math.floor(
      Math.random() * 300
    );

  return Math.min(
    base + jitter,
    10000
  );
}

function buildModelAttemptList(
  primaryModel
) {
  const models = [
    primaryModel
  ];

  if (
    ENABLE_MODEL_FALLBACK &&
    OPENAI_FALLBACK_MODEL &&
    OPENAI_FALLBACK_MODEL !==
      primaryModel
  ) {
    models.push(
      OPENAI_FALLBACK_MODEL
    );
  }

  return models;
}

function logAPIError({
  error,
  model,
  attempt,
  totalAttempts
}) {
  console.warn(
    `[HireVision AI] OpenAI request failed ` +
      `(attempt ${attempt}/${totalAttempts}, model=${model})`,
    {
      message:
        error?.message,
      status:
        error?.status,
      code:
        error?.code,
      requestId:
        error?.requestId
    }
  );
}

/* =========================================================================
   FETCH / TIMEOUT
   ========================================================================= */

async function fetchWithTimeout(
  url,
  options,
  timeout
) {
  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      timeout
    );

  try {
    return await fetch(
      url,
      {
        ...options,
        signal:
          controller.signal
      }
    );
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      const timeoutError =
        new Error(
          "The AI request timed out. Please try again."
        );

      timeoutError.name =
        "OpenAITimeoutError";

      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

/* =========================================================================
   OPTION HELPERS
   ========================================================================= */

function normalizeTemperature(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return undefined;
  }

  return Math.min(
    2,
    Math.max(
      0,
      number
    )
  );
}

function normalizePositiveNumber(
  value,
  fallback
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return fallback;
  }

  return number;
}

function normalizeReasoningEffort(
  value
) {
  const allowed =
    new Set([
      "none",
      "low",
      "medium",
      "high",
      "xhigh",
      "max"
    ]);

  const normalized =
    String(
      value || "medium"
    )
      .trim()
      .toLowerCase();

  return allowed.has(
    normalized
  )
    ? normalized
    : "medium";
}

function normalizeVerbosity(
  value
) {
  const allowed =
    new Set([
      "low",
      "medium",
      "high"
    ]);

  const normalized =
    String(
      value || "medium"
    )
      .trim()
      .toLowerCase();

  return allowed.has(
    normalized
  )
    ? normalized
    : "medium";
}

function isReasoningModel(
  model
) {
  return /^gpt-5/i.test(
    String(model || "")
  );
}

function supportsTemperature(
  model
) {
  /**
   * Keep temperature out of GPT-5 reasoning requests unless
   * explicitly supported by the selected model.
   */
  return !isReasoningModel(
    model
  );
}

function supportsVerbosity(
  model
) {
  return Boolean(model);
}

function sanitizeMetadata(
  metadata
) {
  if (
    !metadata ||
    typeof metadata !== "object"
  ) {
    return undefined;
  }

  const output = {};

  for (
    const [key, value]
      of Object.entries(
        metadata
      )
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      continue;
    }

    output[
      String(key).slice(0, 64)
    ] = String(value).slice(
      0,
      512
    );
  }

  return output;
}

function safeSerializeToolOutput(
  value
) {
  if (
    typeof value === "string"
  ) {
    return value;
  }

  try {
    return JSON.stringify(
      value ?? null
    );
  } catch {
    return JSON.stringify({
      error:
        "Tool returned a value that could not be serialized."
    });
  }
}

function createRequestId() {
  return `hv_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}

/* =========================================================================
   STREAMING FOUNDATION
   ========================================================================= */

/**
 * Streaming helper for future ChatGPT-style UI.
 *
 * Current agents can continue using callLLM().
 * The frontend streaming layer can later consume this function.
 */
async function streamLLM(
  systemPrompt,
  userPrompt,
  options = {}
) {
  validateConfiguration();

  const normalized =
    normalizeLLMOptions(
      systemPrompt,
      userPrompt,
      options
    );

  if (
    OPENAI_API_MODE !==
    "responses"
  ) {
    throw new Error(
      "Streaming currently requires OPENAI_API_MODE=responses."
    );
  }

  const payload = {
    model:
      normalized.model,
    instructions:
      normalized.systemPrompt,
    input:
      buildResponsesInput(
        normalized.conversation,
        normalized.userPrompt
      ),
    max_output_tokens:
      normalized.maxOutputTokens,
    stream: true,
    store:
      normalized.store
  };

  if (
    normalized.reasoningEffort &&
    isReasoningModel(
      normalized.model
    )
  ) {
    payload.reasoning = {
      effort:
        normalized.reasoningEffort
    };
  }

  if (
    normalized.temperature !==
      undefined &&
    supportsTemperature(
      normalized.model
    )
  ) {
    payload.temperature =
      normalized.temperature;
  }

  const requestId =
    createRequestId();

  const response =
    await fetchWithTimeout(
      OPENAI_RESPONSES_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${OPENAI_API_KEY}`,
          "X-Client-Request-Id":
            requestId
        },
        body:
          JSON.stringify(
            payload
          )
      },
      normalized.timeout
    );

  if (!response.ok) {
    const data =
      await parseResponseBody(
        response
      );

    throw createAPIError(
      response,
      data,
      requestId
    );
  }

  if (
    !response.body
  ) {
    throw new Error(
      "OpenAI streaming response did not contain a readable body."
    );
  }

  return {
    stream:
      response.body,
    requestId
  };
}

/* =========================================================================
   EXPORTS
   ========================================================================= */

module.exports = {
  callLLM,
  callLLMResponse,
  callLLMWithTools,
  streamLLM,
  normalizeLanguage,
  getLanguageInstruction,
  parseJsonResponse,
  cleanTextResponse
};