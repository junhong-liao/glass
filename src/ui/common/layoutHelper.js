// Layout Helper for Renderer Components
// Provides convenient functions for updating layout state

/**
 * Update layout state with a patch
 * @param {Object} patch - Patch object to merge into layout state
 * @returns {Promise} - Resolves when update is complete
 */
export async function updateLayout(patch) {
    if (!window.api?.layout?.update) {
        console.warn('[LayoutHelper] Layout API not available');
        return;
    }
    
    try {
        await window.api.layout.update(patch);
        console.log('[LayoutHelper] Layout updated:', patch);
    } catch (error) {
        console.error('[LayoutHelper] Failed to update layout:', error);
    }
}

/**
 * Update header bounds and visual center
 * @param {Object} bounds - New header bounds {x, y, width, height}
 */
export async function updateHeaderBounds(bounds) {
    // Visual center is relative to the header itself, not screen position
    // This ensures dialogue boxes stay centered to the header regardless of header width
    const visualCenterX = bounds.width / 2;
    return updateLayout({
        header: { 
            bounds,
            visualCenterX
        }
    });
}

/**
 * Update window visibility
 * @param {string} windowName - 'ask' or 'listen'
 * @param {boolean} visible - Whether window should be visible
 */
export async function updateWindowVisibility(windowName, visible) {
    return updateLayout({
        [windowName]: { visible }
    });
}

/**
 * Update window dimensions
 * @param {string} windowName - 'ask' or 'listen'
 * @param {number} width - New width
 * @param {number} height - New height
 */
export async function updateWindowSize(windowName, width, height) {
    return updateLayout({
        [windowName]: { width, height }
    });
}

/**
 * Update only window height (common case)
 * @param {string} windowName - 'ask' or 'listen'
 * @param {number} height - New height
 */
export async function updateWindowHeight(windowName, height) {
    return updateLayout({
        [windowName]: { height }
    });
}