const { collection, addDoc, query, getDocs, orderBy, where, Timestamp } = require('firebase/firestore');
const { getFirestoreInstance } = require('../../common/services/firebaseClient');
const { createEncryptedConverter } = require('../../common/repositories/firestoreConverter');

const aiMessageConverter = createEncryptedConverter(['content']);

function aiMessagesCol(sessionId) {
    if (!sessionId) throw new Error("Session ID is required to access AI messages.");
    const db = getFirestoreInstance();
    return collection(db, `sessions/${sessionId}/ai_messages`).withConverter(aiMessageConverter);
}

async function addAiMessage({ uid, sessionId, role, content, model = 'unknown' }) {
    const now = Timestamp.now();
    const newMessage = {
        uid, // To identify the author of the message
        session_id: sessionId,
        sent_at: now,
        role,
        content,
        model,
        created_at: now,
    };
    
    const docRef = await addDoc(aiMessagesCol(sessionId), newMessage);
    return { id: docRef.id };
}

async function getAllAiMessagesBySessionId(sessionId) {
    const q = query(aiMessagesCol(sessionId), orderBy('sent_at', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
}

async function getAllRecentMessagesByUserId(uid, limit = 50, excludeSessionId) {
    try {
        const db = getFirestoreInstance();

        // 1. Find ended sessions for this user
        const sessionsSnap = await getDocs(
            query(
                collection(db, 'sessions'),
                where('uid', '==', uid),
                where('ended_at', '!=', null)
            )
        );

        // 2. Pull messages from each ended session
        let allMessages = [];
        for (const sessionDoc of sessionsSnap.docs) {
            const sessionId = sessionDoc.id;
            if (sessionId === excludeSessionId) continue;

            const msgsSnap = await getDocs(
                query(
                    aiMessagesCol(sessionId),
                    orderBy('sent_at', 'asc')
                )
            );
            msgsSnap.forEach(msgDoc => allMessages.push(msgDoc.data()));
        }

        // 3. Filter and prioritize messages
        allMessages = allMessages
            .filter(m => {
                if (!m.content || m.content.length <= 10) return false;
                
                const lowerContent = m.content.toLowerCase();
                // Filter out unhelpful responses
                if (lowerContent.includes("i don't know") || 
                    lowerContent.includes("i don't have") || 
                    lowerContent.includes("i'm not sure") ||
                    lowerContent.includes("i'm sorry") ||
                    lowerContent.includes("i'm unable") ||
                    lowerContent.includes("i cannot") ||
                    lowerContent.includes("i can't") ||
                    lowerContent.includes("unfortunately") ||
                    lowerContent.includes("i'm afraid")) {
                    return false;
                }
                
                return true;
            })
            .sort((a, b) => {
                // Prioritize longer content first, then older messages for same length
                const lenDiff = b.content.length - a.content.length;
                if (lenDiff !== 0) return lenDiff;
                
                const aTime = a.sent_at?.toMillis?.() || a.sent_at || 0;
                const bTime = b.sent_at?.toMillis?.() || b.sent_at || 0;
                return aTime - bTime; // older first when same length
            })
            .slice(0, limit);

        console.log(`[Firebase] getAllRecentMessagesByUserId: Found ${allMessages.length} messages for user ${uid}`);
        return allMessages;
    } catch (err) {
        console.error('[Firebase] Error in getAllRecentMessagesByUserId:', err);
        return [];
    }
}

module.exports = {
    addAiMessage,
    getAllAiMessagesBySessionId,
    getAllRecentMessagesByUserId,
}; 