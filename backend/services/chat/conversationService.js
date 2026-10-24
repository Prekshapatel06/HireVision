const db = require("../../config/db");

const DEFAULT_TITLE = "New conversation";
const MAX_TITLE_LENGTH = 200;

function normalizeUserId(userId) {
  if (userId === undefined || userId === null) {
    throw new Error("User ID is required.");
  }

  const normalized = String(userId).trim();

  if (!normalized) {
    throw new Error("User ID is required.");
  }

  return normalized;
}

function normalizeChatId(chatId) {
  if (chatId === undefined || chatId === null) {
    throw new Error("Chat ID is required.");
  }

  const normalized = String(chatId).trim();

  if (!normalized) {
    throw new Error("Chat ID is required.");
  }

  return normalized;
}

function normalizeTitle(title) {
  if (title === undefined || title === null) {
    return DEFAULT_TITLE;
  }

  const normalized = String(title).trim();

  if (!normalized) {
    return DEFAULT_TITLE;
  }

  return normalized.slice(0, MAX_TITLE_LENGTH);
}

async function createConversation(
  userId,
  title = DEFAULT_TITLE
) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedTitle = normalizeTitle(title);

  const result = await db.query(
    `
    INSERT INTO ai_chats (
      user_id,
      title,
      created_at,
      updated_at,
      deleted,
      is_deleted
    )
    VALUES (
      $1,
      $2,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      false,
      false
    )
    RETURNING *
    `,
    [
      normalizedUserId,
      normalizedTitle
    ]
  );

  return result.rows[0];
}

async function listConversations(userId) {
  const normalizedUserId = normalizeUserId(userId);

  const result = await db.query(
    `
    SELECT
      id,
      title,
      created_at,
      updated_at,
      deleted,
      is_deleted
    FROM ai_chats
    WHERE user_id = $1
      AND COALESCE(deleted, false) = false
      AND COALESCE(is_deleted, false) = false
    ORDER BY
      COALESCE(updated_at, created_at) DESC,
      id DESC
    `,
    [normalizedUserId]
  );

  return result.rows;
}

async function getConversationForUser(
  chatId,
  userId
) {
  const normalizedChatId = normalizeChatId(chatId);
  const normalizedUserId = normalizeUserId(userId);

  const result = await db.query(
    `
    SELECT *
    FROM ai_chats
    WHERE id = $1
      AND user_id = $2
      AND COALESCE(deleted, false) = false
      AND COALESCE(is_deleted, false) = false
    LIMIT 1
    `,
    [
      normalizedChatId,
      normalizedUserId
    ]
  );

  return result.rows[0] || null;
}

async function softDeleteConversation(
  chatId,
  userId
) {
  const normalizedChatId = normalizeChatId(chatId);
  const normalizedUserId = normalizeUserId(userId);

  const result = await db.query(
    `
    UPDATE ai_chats
    SET
      deleted = true,
      is_deleted = true,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
      AND user_id = $2
      AND COALESCE(deleted, false) = false
      AND COALESCE(is_deleted, false) = false
    RETURNING *
    `,
    [
      normalizedChatId,
      normalizedUserId
    ]
  );

  return result.rows[0] || null;
}

async function resetConversationMessages(
  chatId,
  userId
) {
  const normalizedChatId = normalizeChatId(chatId);
  const normalizedUserId = normalizeUserId(userId);

  const conversation = await getConversationForUser(
    normalizedChatId,
    normalizedUserId
  );

  if (!conversation) {
    return null;
  }

  const client = await db.getPool().connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM ai_chat_messages
      WHERE chat_id = $1
      `,
      [normalizedChatId]
    );

    const updatedConversation = await client.query(
      `
      UPDATE ai_chats
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND user_id = $2
        AND COALESCE(deleted, false) = false
        AND COALESCE(is_deleted, false) = false
      RETURNING *
      `,
      [
        normalizedChatId,
        normalizedUserId
      ]
    );

    await client.query("COMMIT");

    return updatedConversation.rows[0] || conversation;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "[Conversation Service] Rollback failed:",
        rollbackError.message
      );
    }

    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createConversation,
  listConversations,
  getConversationForUser,
  softDeleteConversation,
  resetConversationMessages,
};