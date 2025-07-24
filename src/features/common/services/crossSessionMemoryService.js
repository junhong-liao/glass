const authService = require('./authService');
const memoryConfig = require('../config/memoryConfig');

class CrossSessionMemoryService {
    constructor(askRepository) {
        this.askRepository = askRepository;
    }

    async _getBackgroundMessages(sessionId) {
        try {
            const currentUser = authService.getCurrentUser();
            if (!currentUser || !currentUser.uid) {
                console.log('[CrossSessionMemoryService] No current user, skipping background messages');
                return [];
            }

            const limit = memoryConfig.MAX_BACKGROUND_MESSAGES;
            const messages = await this.askRepository.getAllRecentMessagesByUserId(currentUser.uid, limit, sessionId);
            
            console.log(`[CrossSessionMemoryService] Background messages found: ${messages.length}`);
            return messages;
        } catch (err) {
            console.error('[CrossSessionMemoryService] Error getting background messages:', err);
            return [];
        }
    }

    async buildConversationWithMemory(currentSessionMessages, sessionId) {
        try {
            const backgroundMessages = await this._getBackgroundMessages(sessionId);
            
            // Calculate how many current session messages to include
            const totalLimit = memoryConfig.MAX_TOTAL_MESSAGES;
            const backgroundRatio = memoryConfig.BACKGROUND_SESSION_RATIO;
            const maxBackgroundCount = Math.floor(totalLimit * backgroundRatio);
            const maxCurrentCount = totalLimit - maxBackgroundCount;

            // Limit background messages
            const limitedBackgroundMessages = backgroundMessages.slice(0, maxBackgroundCount);
            
            // Limit current session messages
            const limitedCurrentMessages = currentSessionMessages.slice(-maxCurrentCount);

            // Combine: background first, then current session
            const allMessages = [...limitedBackgroundMessages, ...limitedCurrentMessages];

            console.log(`[CrossSessionMemoryService] Built conversation: ${limitedBackgroundMessages.length} background + ${limitedCurrentMessages.length} current = ${allMessages.length} total`);
            
            return allMessages;
        } catch (err) {
            console.error('[CrossSessionMemoryService] Error building conversation with memory:', err);
            return currentSessionMessages;
        }
    }
}

module.exports = CrossSessionMemoryService;