const db = require("../../config/db");

const MAX_CONTENT_LENGTH = 100000;
const MAX_METADATA_LENGTH = 50000;

const ALLOWED_ROLES = [
  "user",
  "assistant",
  "system",
  "tool"
];

const ALLOWED_SENDERS = [
  "user",
  "ai",
  "assistant",
  "system",
  "tool"
];

function normalizeId(value, fieldName) {
  if (value === undefined || value === null) {
    throw new Error(`${fieldName} is required.`);
  }

  const normalized = String(value).trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeSender(sender) {
  const normalized = String(sender || "").trim().toLowerCase();

  if (!normalized) {
    throw new Error("Message sender is required.");
  }

  if (!ALLOWED_SENDERS.includes(normalized)) {
    throw new Error(
      `Invalid message sender. Allowed values: ${ALLOWED_SENDERS.join(", ")}.`
    );
  }

  return normalized;
}

function normalizeRole(role) {
  const normalized = String(role || "").trim().toLowerCase();

  if (!normalized) {
    throw new Error("Message role is required.");
  }

  if (!ALLOWED_ROLES.includes(normalized)) {
    throw new Error(
      `Invalid message role. Allowed values: ${ALLOWED_ROLES.join(", ")}.`
    );
  }

  return normalized;
}

function normalizeContent(content) {
  if (content === undefined || content === null) {
    throw new Error("Message content is required.");
  }

  const normalized = String(content).trim();

  if (!normalized) {
    throw new Error("Message content cannot be empty.");
  }

  if (normalized.length > MAX_CONTENT_LENGTH) {
    throw new Error(
      `Message content exceeds the maximum allowed length of ${MAX_CONTENT_LENGTH} characters.`
    );
  }

  return normalized;
}

function normalizeMetadata(metadata) {
  if (
    metadata === undefined ||
    metadata === null
  ) {
    return {};
  }

  if (
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    throw new Error("Message metadata must be a JSON object.");
  }

  const serialized = JSON.stringify(metadata);

  if (serialized.length > MAX_METADATA_LENGTH) {
    throw new Error(
      `Message metadata exceeds the maximum allowed size of ${MAX_METADATA_LENGTH} characters.`
    );
  }

  return metadata;
}

async function listMessages(chatId) {
  const normalizedChatId = normalizeId(
    chatId,
    "Chat ID"
  );

  const result = await db.query(
    `
    SELECT
      *
    FROM ai_chat_messages
    WHERE chat_id = $1
      AND EXISTS (
        SELECT 1
        FROM ai_chats c
        WHERE c.id = $1
          AND COALESCE(c.deleted, false) = false
          AND COALESCE(c.is_deleted, false) = false
      )
    ORDER BY
      created_at ASC,
      id ASC
    `,
    [normalizedChatId]
  );

  return result.rows;
}

async function saveMessage(
  chatId,
  sender,
  role,
  content,
  metadata = {}
) {
  const normalizedChatId = normalizeId(
    chatId,
    "Chat ID"
  );

  const normalizedSender = normalizeSender(sender);
  const normalizedRole = normalizeRole(role);
  const normalizedContent = normalizeContent(content);
  const normalizedMetadata = normalizeMetadata(metadata);

  const chatCheck = await db.query(
    `
    SELECT id
    FROM ai_chats
    WHERE id = $1
      AND COALESCE(deleted, false) = false
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
    `,
    [normalizedChatId]
  );

  if (chatCheck.rowCount === 0) {
    throw new Error(
      "Conversation not found or is no longer active."
    );
  }

  const result = await db.query(
    `
    INSERT INTO ai_chat_messages (
      chat_id,
      sender,
      role,
      content,
      metadata,
      created_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5::jsonb,
      CURRENT_TIMESTAMP
    )
    RETURNING *
    `,
    [
      normalizedChatId,
      normalizedSender,
      normalizedRole,
      normalizedContent,
      JSON.stringify(normalizedMetadata)
    ]
  );

  await db.query(
    `
    UPDATE ai_chats
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
      AND COALESCE(deleted, false) = false
      AND COALESCE(is_deleted, false) = false
    `,
    [normalizedChatId]
  );

  return result.rows[0];
}

module.exports = {
  listMessages,
  saveMessage,
};