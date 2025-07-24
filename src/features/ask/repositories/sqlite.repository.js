const sqliteClient = require('../../common/services/sqliteClient');

function addAiMessage({ uid, sessionId, role, content, model = 'unknown' }) {
    // uid is ignored in the SQLite implementation
    const db = sqliteClient.getDb();
    const messageId = require('crypto').randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const query = `INSERT INTO ai_messages (id, session_id, sent_at, role, content, model, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    try {
        db.prepare(query).run(messageId, sessionId, now, role, content, model, now);
        return { id: messageId };
    } catch (err) {
        console.error('SQLite: Failed to add AI message:', err);
        throw err;
    }
}

function getAllAiMessagesBySessionId(sessionId) {
    const db = sqliteClient.getDb();
    const query = "SELECT * FROM ai_messages WHERE session_id = ? ORDER BY sent_at ASC";
    return db.prepare(query).all(sessionId);
}

function getAllRecentMessagesByUserId(uid, limit = 50, excludeSessionId) {
    const db = sqliteClient.getDb();
    const query = `
        SELECT am.* FROM ai_messages am
        JOIN sessions s ON am.session_id = s.id
        WHERE s.uid = ? 
          AND s.ended_at IS NOT NULL
          AND am.session_id != COALESCE(?, '')
          AND length(am.content) > 10
          AND lower(am.content) NOT LIKE '%i don''t know%'
          AND lower(am.content) NOT LIKE '%i don''t have%'
          AND lower(am.content) NOT LIKE '%i''m not sure%'
          AND lower(am.content) NOT LIKE '%i''m sorry%'
          AND lower(am.content) NOT LIKE '%i''m unable%'
          AND lower(am.content) NOT LIKE '%i cannot%'
          AND lower(am.content) NOT LIKE '%i can''t%'
          AND lower(am.content) NOT LIKE '%unfortunately%'
          AND lower(am.content) NOT LIKE '%i''m afraid%'
        ORDER BY length(am.content) DESC, am.sent_at ASC
        LIMIT ?
    `;
    
    try {
        const messages = db.prepare(query).all(uid, excludeSessionId || '', limit);
        console.log(`[SQLite] getAllRecentMessagesByUserId: Found ${messages.length} messages for user ${uid}`);
        return messages;
    } catch (err) {
        console.error('[SQLite] Error in getAllRecentMessagesByUserId:', err);
        return [];
    }
}

module.exports = {
    addAiMessage,
    getAllAiMessagesBySessionId,
    getAllRecentMessagesByUserId
}; 