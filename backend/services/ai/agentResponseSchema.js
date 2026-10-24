/**
 * HireVision AI
 * Standard Agent Response Schema
 *
 * This file intentionally supports both the older HireVision
 * agent response format and the newer structured agent format.
 */

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}


function safeArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}


function extractResponseText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value?.response === "string") {
    return value.response.trim();
  }

  if (typeof value?.reply === "string") {
    return value.reply.trim();
  }

  if (typeof value?.answer === "string") {
    return value.answer.trim();
  }

  if (typeof value?.summary === "string") {
    return value.summary.trim();
  }

  if (typeof value?.message === "string") {
    return value.message.trim();
  }

  if (typeof value?.result === "string") {
    return value.result.trim();
  }

  if (
    value?.result &&
    typeof value.result === "object"
  ) {
    if (
      typeof value.result.response ===
      "string"
    ) {
      return value.result.response.trim();
    }

    if (
      typeof value.result.reply ===
      "string"
    ) {
      return value.result.reply.trim();
    }

    if (
      typeof value.result.answer ===
      "string"
    ) {
      return value.result.answer.trim();
    }

    if (
      typeof value.result.summary ===
      "string"
    ) {
      return value.result.summary.trim();
    }

    if (
      typeof value.result.message ===
      "string"
    ) {
      return value.result.message.trim();
    }
  }

  return "";
}


/**
 * Older HireVision helper.
 */
function failedAgentResponse(
  name,
  error,
  extra = {}
) {
  const errorObject =
    error &&
    typeof error === "object"
      ? error
      : new Error(
          cleanText(error) ||
            "Specialist agent failed."
        );

  return {
    agent_name:
      cleanText(name) ||
      "unknown_agent",

    agent:
      cleanText(name) ||
      "unknown_agent",

    name:
      cleanText(name) ||
      "unknown_agent",

    status: "error",

    success: false,

    result: null,

    response: "",

    reply: "",

    error: {
      code:
        errorObject.code ||
        extra?.error?.code ||
        "AGENT_EXECUTION_FAILED",

      message:
        errorObject.message ||
        extra?.error?.message ||
        "Specialist agent failed to generate a response.",

      retryable:
        extra?.error?.retryable ??
        false,
    },

    metadata:
      extra?.metadata &&
      typeof extra.metadata === "object"
        ? extra.metadata
        : {},

    missing_data:
      safeArray(
        extra?.missing_data
      ),

    actions:
      safeArray(
        extra?.actions
      ),

    sources:
      safeArray(
        extra?.sources
      ),
  };
}


/**
 * Older HireVision helper.
 */
function successfulAgentResponse(
  name,
  result,
  extra = {}
) {
  const response =
    extractResponseText(result);

  return {
    agent_name:
      cleanText(name) ||
      "unknown_agent",

    agent:
      cleanText(name) ||
      "unknown_agent",

    name:
      cleanText(name) ||
      "unknown_agent",

    status:
      extra?.status ||
      "ok",

    success: true,

    result,

    response,

    reply: response,

    error: null,

    metadata:
      extra?.metadata &&
      typeof extra.metadata === "object"
        ? extra.metadata
        : {},

    missing_data:
      safeArray(
        extra?.missing_data
      ),

    actions:
      safeArray(
        extra?.actions
      ),

    sources:
      safeArray(
        extra?.sources
      ),
  };
}


/**
 * Main compatibility normalizer used by the current
 * Candidate and Recruiter AI agents.
 *
 * Supported:
 *
 * normalizeAgentResponse(
 *   "profile_agent",
 *   payload,
 *   options
 * )
 *
 * and:
 *
 * normalizeAgentResponse(payload)
 */
function normalizeAgentResponse(
  nameOrValue,
  payload,
  options = {}
) {
  let agentName;
  let value;
  let config;

  if (
    typeof nameOrValue ===
      "string" &&
    arguments.length >= 2
  ) {
    agentName =
      cleanText(nameOrValue) ||
      "unknown_agent";

    value =
      payload;

    config =
      options || {};
  } else {
    agentName =
      cleanText(
        nameOrValue?.agent_name ||
          nameOrValue?.agent ||
          nameOrValue?.name
      ) ||
      "unknown_agent";

    value =
      nameOrValue;

    config =
      payload &&
      typeof payload === "object"
        ? payload
        : {};
  }


  if (
    value === null ||
    value === undefined
  ) {
    return {
      agent_name:
        agentName,

      agent:
        agentName,

      name:
        agentName,

      status:
        config.status ||
        "ok",

      success:
        config.status !==
        "error",

      result: null,

      response: "",

      reply: "",

      error:
        config.error ||
        null,

      metadata:
        config.metadata ||
        {},

      missing_data: [],

      actions: [],

      sources: [],
    };
  }


  if (
    typeof value ===
    "string"
  ) {
    const response =
      value.trim();

    return {
      agent_name:
        agentName,

      agent:
        agentName,

      name:
        agentName,

      status:
        config.status ||
        "ok",

      success:
        config.status !==
        "error",

      result:
        response,

      response,

      reply:
        response,

      error:
        config.error ||
        null,

      metadata:
        config.metadata ||
        {},

      missing_data: [],

      actions: [],

      sources: [],
    };
  }


  const valueObject =
    typeof value ===
      "object"
      ? value
      : {
          result: value,
        };


  const response =
    extractResponseText(
      valueObject
    );


  const status =
    cleanText(
      config.status ||
        valueObject.status
    ) ||
    (
      config.error ||
      valueObject.error
        ? "error"
        : "ok"
    );


  const error =
    config.error ||
    valueObject.error ||
    null;


  const success =
    typeof valueObject.success ===
      "boolean"
      ? valueObject.success
      : status !== "error";


  let result;

  if (
    Object.prototype
      .hasOwnProperty
      .call(
        valueObject,
        "result"
      )
  ) {
    result =
      valueObject.result;
  } else {
    result =
      valueObject;
  }


  return {
    ...valueObject,

    agent_name:
      cleanText(
        valueObject.agent_name ||
          valueObject.agent ||
          valueObject.name
      ) ||
      agentName,

    agent:
      cleanText(
        valueObject.agent ||
          valueObject.agent_name ||
          valueObject.name
      ) ||
      agentName,

    name:
      cleanText(
        valueObject.name ||
          valueObject.agent_name ||
          valueObject.agent
      ) ||
      agentName,

    status,

    success,

    result,

    response:
      response ||
      (
        typeof valueObject.response ===
          "string"
          ? valueObject.response
          : ""
      ),

    reply:
      response ||
      (
        typeof valueObject.reply ===
          "string"
          ? valueObject.reply
          : ""
      ),

    error,

    metadata: {
      ...(
        valueObject.metadata &&
        typeof valueObject.metadata ===
          "object"
          ? valueObject.metadata
          : {}
      ),

      ...(
        config.metadata &&
        typeof config.metadata ===
          "object"
          ? config.metadata
          : {}
      ),
    },

    missing_data:
      safeArray(
        valueObject.missing_data
      ),

    actions:
      safeArray(
        valueObject.actions
      ),

    sources:
      safeArray(
        valueObject.sources
      ),
  };
}


/**
 * Converts any structured result into simple readable text.
 */
function normalizeAgentResult(
  value
) {
  return extractResponseText(
    value
  );
}


module.exports = {
  failedAgentResponse,
  successfulAgentResponse,
  normalizeAgentResponse,
  normalizeAgentResult,
};