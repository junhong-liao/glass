const { profilePrompts } = require('./promptTemplates.js');

function buildSystemPrompt(promptParts, customPrompt = '', googleSearchEnabled = true) {
    const sections = [promptParts.intro, '\n\n', promptParts.formatRequirements];

    if (googleSearchEnabled) {
        sections.push('\n\n', promptParts.searchUsage);
    }

    // Replace {{CONVERSATION_HISTORY}} placeholder with actual conversation history
    let content = promptParts.content;
    if (content.includes('{{CONVERSATION_HISTORY}}')) {
        content = content.replace('{{CONVERSATION_HISTORY}}', customPrompt || 'No conversation history available.');
        sections.push('\n\n', content, '\n\n', promptParts.outputInstructions);
    } else {
        // Fallback to old behavior for other templates
        sections.push('\n\n', content, '\n\nUser-provided context\n-----\n', customPrompt, '\n-----\n\n', promptParts.outputInstructions);
    }

    return sections.join('');
}

function getSystemPrompt(profile, customPrompt = '', googleSearchEnabled = true) {
    const promptParts = profilePrompts[profile] || profilePrompts.interview;
    return buildSystemPrompt(promptParts, customPrompt, googleSearchEnabled);
}

module.exports = {
    getSystemPrompt,
};
