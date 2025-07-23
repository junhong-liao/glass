# How to Add a New Keyboard Shortcut to Glass

This document outlines the step-by-step process for adding a new keyboard shortcut to the Glass application, following the existing architecture patterns.

## Overview

Glass uses a centralized shortcut system with the following components:
- **ShortcutsService**: Manages global shortcuts and handlers
- **Settings UI**: Allows users to configure shortcut key combinations  
- **Service Integration**: Direct calls to existing services (recommended approach)

## Architecture Patterns

Glass shortcuts follow these established patterns:
- **Direct Service Calls**: Import services and call methods directly (like `askService.toggleAskButton()`)
- **Internal Methods**: Call methods within ShortcutsService (like `this.toggleAllWindowsVisibility()`)
- **Simple Event Emission**: Use `internalBridge.emit()` for basic notifications

## Step-by-Step Process

### 1. Add Shortcut to Default Keybinds

**File**: `/src/features/shortcuts/shortcutsService.js`

In the `getDefaultKeybinds()` method, add your new shortcut:

```javascript
getDefaultKeybinds() {
    const isMac = process.platform === 'darwin';
    return {
        // ... existing shortcuts
        yourShortcutName: isMac ? 'Cmd+Shift+X' : 'Ctrl+Shift+X',
    };
}
```

**Naming Convention**: Use camelCase (e.g., `toggleListen`, `quickScreenshot`)  
**Key Combinations**: Use Electron's accelerator format (e.g., `Cmd+Shift+L`, `Ctrl+Alt+S`)

### 2. Import Required Services

**File**: `/src/features/shortcuts/shortcutsService.js`

Add service imports at the top of the file (follow existing pattern):

```javascript
const { globalShortcut, screen } = require('electron');
const shortcutsRepository = require('./repositories');
const internalBridge = require('../../bridge/internalBridge');
const askService = require('../ask/askService');
const yourService = require('../path/to/yourService'); // Add your service import
```

### 3. Add Shortcut Handler

**File**: `/src/features/shortcuts/shortcutsService.js`

In the `registerShortcuts()` method, add a new case to the switch statement:

```javascript
switch(action) {
    // ... existing cases
    case 'yourShortcutName':
        callback = async () => {
            // Direct service call pattern (RECOMMENDED)
            const isActive = yourService.isActive();
            if (isActive) {
                await yourService.stop();
            } else {
                await yourService.start();
            }
        };
        break;
}
```

**Handler Patterns**:
- **Service Integration**: `callback = async () => { await someService.method(); }`
- **Internal Method**: `callback = () => this.someMethod();`
- **Simple Event**: `callback = () => internalBridge.emit('event-name');`

### 4. Add Display Name for Settings UI

**File**: `/src/ui/settings/ShortCutSettingsView.js`

Add your shortcut to the `displayNameMap`:

```javascript
const displayNameMap = {
    // ... existing entries
    yourShortcutName: 'Your Shortcut Display Name',
};
```

**Naming Convention**: Use human-readable names (e.g., "Toggle Listen Mode", "Quick Screenshot")

## Complete Example: Toggle Listen Shortcut

Here's the actual implementation for the `toggleListen` shortcut:

### 1. Default Keybind
```javascript
// /src/features/shortcuts/shortcutsService.js
toggleListen: isMac ? 'Cmd+Shift+L' : 'Ctrl+Shift+L',
```

### 2. Service Import
```javascript
// /src/features/shortcuts/shortcutsService.js (top of file)
const listenService = require('../listen/listenService');
```

### 3. Handler Implementation
```javascript
// /src/features/shortcuts/shortcutsService.js
case 'toggleListen':
    callback = async () => {
        const isActive = listenService.isSessionActive();
        if (isActive) {
            await listenService.handleListenRequest('Stop');
            await listenService.handleListenRequest('Done');
        } else {
            await listenService.handleListenRequest('Listen');
        }
    };
    break;
```

### 4. Display Name
```javascript
// /src/ui/settings/ShortCutSettingsView.js
toggleListen: 'Toggle Listen Mode',
```

## Testing Your Implementation

### 1. Syntax Validation
```bash
node -c src/features/shortcuts/shortcutsService.js
node -c src/ui/settings/ShortCutSettingsView.js
```

### 2. Test Default Keybinds
```bash
node -e "
const service = require('./src/features/shortcuts/shortcutsService.js');
const defaults = service.getDefaultKeybinds();
console.log('Your shortcut:', defaults.yourShortcutName);
console.log('All shortcuts:', Object.keys(defaults));
"
```

### 3. Verify Settings UI
```bash
node -e "
const fs = require('fs');
const content = fs.readFileSync('./src/ui/settings/ShortCutSettingsView.js', 'utf8');
console.log(content.includes('yourShortcutName') ? '✅ Found in settings' : '❌ Missing from settings');
"
```

### 4. Runtime Testing
1. Start the app: `npm start`
2. Check that your shortcut appears in Settings > Shortcuts
3. Test the keyboard combination
4. Verify the expected behavior occurs

## Best Practices

1. **Follow Existing Patterns**: Study how similar shortcuts are implemented
2. **Import Services Properly**: Add imports at the top of the file, not inside handlers
3. **Use Async/Await**: For service calls that return promises
4. **Handle Errors**: Wrap complex logic in try-catch blocks
5. **Test Thoroughly**: Validate both syntax and functionality
6. **Platform Compatibility**: Use the existing `isMac` pattern for cross-platform shortcuts

## Common Patterns Reference

### Service Integration (Recommended)
```javascript
// Import at top
const someService = require('../path/to/service');

// Use in handler
case 'yourShortcut':
    callback = async () => {
        await someService.toggle();
    };
    break;
```

### Window Management
```javascript
case 'showWindow':
    callback = () => internalBridge.emit('window:requestVisibility', { 
        name: 'windowName', 
        visible: true 
    });
    break;
```

### Internal ShortcutsService Methods
```javascript
case 'toggleVisibility':
    callback = () => this.toggleAllWindowsVisibility();
    break;
```

## Troubleshooting

**Issue**: App windows disappear after adding shortcut  
**Solution**: Check for syntax errors or circular dependency issues in service imports

**Issue**: Shortcut doesn't appear in settings  
**Solution**: Verify `displayNameMap` entry matches the shortcut name exactly

**Issue**: Shortcut doesn't work  
**Solution**: Check that the service method exists and returns appropriate values

**Issue**: Complex async operations cause crashes  
**Solution**: Simplify the handler logic and avoid heavy operations in shortcut callbacks

This approach ensures shortcuts integrate seamlessly with Glass's existing architecture while maintaining stability and user experience.