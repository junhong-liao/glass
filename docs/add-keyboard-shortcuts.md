How to Add a New Keyboard Shortcut to Glass

  This document outlines the step-by-step process for adding a new keyboard shortcut to the Glass
  application, following the existing architecture patterns.

  Overview

  Glass uses a centralized shortcut system with the following components:
  - ShortcutsService: Manages global shortcuts and handlers
  - Settings UI: Allows users to configure shortcut key combinations
  - IPC System: Handles communication between main and renderer processes
  - Preload Script: Exposes IPC methods to renderer processes

  Step-by-Step Process

  1. Add Shortcut to Default Keybinds

  File: /src/features/shortcuts/shortcutsService.js

  In the getDefaultKeybinds() method, add your new shortcut:

  getDefaultKeybinds() {
      const isMac = process.platform === 'darwin';
      return {
          // ... existing shortcuts
          yourShortcutName: isMac ? 'Cmd+Shift+X' : 'Ctrl+Shift+X',
      };
  }

  Naming Convention: Use camelCase (e.g., toggleListen, quickScreenshot)
  Key Combinations: Use Electron's accelerator format (e.g., Cmd+Shift+L, Ctrl+Alt+S)

  2. Add Shortcut Handler

  File: /src/features/shortcuts/shortcutsService.js

  In the registerShortcuts() method, add a new case to the switch statement:

  switch(action) {
      // ... existing cases
      case 'yourShortcutName':
          callback = async () => {
              // Your shortcut logic here
              // Can use existing services:
              // const someService = require('../path/to/service');

              // For IPC communication to all windows:
              // sendToRenderer('your-event-name', data);

              // For window management:
              // internalBridge.emit('window:requestVisibility', { name: 'windowName', visible: true });
          };
          break;
  }

  Patterns to Follow:
  - Use async () => {} for handlers that need to await services
  - Import services with require() inside the handler
  - Use sendToRenderer() to communicate with renderer processes
  - Use internalBridge.emit() for window management

  3. Add Display Name for Settings UI

  File: /src/ui/settings/ShortCutSettingsView.js

  Add your shortcut to the displayNameMap:

  const displayNameMap = {
      // ... existing entries
      yourShortcutName: 'Your Shortcut Display Name',
  };

  Naming Convention: Use human-readable names (e.g., "Toggle Listen Mode", "Quick Screenshot")

  4. Add IPC Communication (if needed)

  If your shortcut needs to communicate with specific renderer processes:

  4a. Update Preload Script

  File: /src/preload.js

  Add IPC listeners to the appropriate namespace:

  // Find the appropriate namespace (e.g., askView, listenView, etc.)
  yourViewNamespace: {
      // ... existing methods
      onYourEvent: (callback) => ipcRenderer.on('your-event-name', callback),
      removeOnYourEvent: (callback) => ipcRenderer.removeListener('your-event-name', callback)
  },

  4b. Update Renderer Component

  File: /src/ui/your-component/YourView.js

  Add event listener in connectedCallback():

  connectedCallback() {
      super.connectedCallback();

      if (window.api) {
          this.handleYourEvent = (event, data) => {
              // Handle the event
              console.log('Event received:', data);
          };
          window.api.yourViewNamespace.onYourEvent(this.handleYourEvent);
      }
  }

  Add cleanup in disconnectedCallback():

  disconnectedCallback() {
      super.disconnectedCallback();

      if (window.api) {
          window.api.yourViewNamespace.removeOnYourEvent(this.handleYourEvent);
      }
  }

  Example Implementation

  Here's the complete implementation for the toggleListen shortcut:

  1. Default Keybind

  // /src/features/shortcuts/shortcutsService.js
  toggleListen: isMac ? 'Cmd+Shift+L' : 'Ctrl+Shift+L',

  2. Handler

  // /src/features/shortcuts/shortcutsService.js
  case 'toggleListen':
      callback = async () => {
          const listenService = require('../listen/listenService');
          const isActive = listenService.isSessionActive();

          if (isActive) {
              await listenService.handleListenRequest('Stop');
              const history = listenService.getConversationHistory();
              if (history.length > 0) {
                  const transcription = history.map(turn => turn.text).join(' ');
                  sendToRenderer('populate-text-input', transcription);
                  internalBridge.emit('window:requestVisibility', { name: 'ask', visible: true });
              }
              await listenService.handleListenRequest('Done');
          } else {
              await listenService.handleListenRequest('Listen');
          }
      };
      break;

  3. Display Name

  // /src/ui/settings/ShortCutSettingsView.js
  toggleListen: 'Toggle Listen Mode',

  4. IPC Setup

  // /src/preload.js
  askView: {
      onPopulateTextInput: (callback) => ipcRenderer.on('populate-text-input', callback),
      removeOnPopulateTextInput: (callback) => ipcRenderer.removeListener('populate-text-input',
  callback)
  },

  // /src/ui/ask/AskView.js - in connectedCallback()
  this.handlePopulateTextInput = (event, transcription) => {
      this.showTextInput = true;
      this.updateComplete.then(() => {
          const textInput = this.shadowRoot.querySelector('#textInput');
          if (textInput) {
              textInput.value = transcription;
              textInput.focus();
          }
      });
  };
  window.api.askView.onPopulateTextInput(this.handlePopulateTextInput);

  // /src/ui/ask/AskView.js - in disconnectedCallback()
  window.api.askView.removeOnPopulateTextInput(this.handlePopulateTextInput);

  Testing Your Implementation

  1. Syntax Validation

  node -c src/features/shortcuts/shortcutsService.js
  node -c src/preload.js

  2. Test Default Keybinds

  node -e "
  const service = require('./src/features/shortcuts/shortcutsService.js');
  const defaults = service.getDefaultKeybinds();
  console.log('Your shortcut:', defaults.yourShortcutName);
  console.log('All shortcuts:', Object.keys(defaults));
  "

  3. Verify Settings UI

  node -e "
  const fs = require('fs');
  const content = fs.readFileSync('./src/ui/settings/ShortCutSettingsView.js', 'utf8');
  console.log(content.includes('yourShortcutName') ? '✅ Found in settings' : '❌ Missing from 
  settings');
  "

  Best Practices

  1. Follow Naming Conventions: Use camelCase for shortcut names and clear display names
  2. Use Existing Services: Import and use existing services rather than duplicating functionality
  3. Handle Errors: Wrap async operations in try-catch blocks
  4. Clean Up Resources: Always remove event listeners in disconnectedCallback
  5. Platform Compatibility: Use the existing isMac pattern for cross-platform shortcuts
  6. Test Thoroughly: Validate syntax and test functionality before deployment

  Common Patterns

  Window Management

  // Show/hide windows
  internalBridge.emit('window:requestVisibility', { name: 'windowName', visible: true });

  // Move windows
  internalBridge.emit('window:moveStep', { direction: 'up' });

  Service Integration

  // Import services inside handlers
  const serviceXyz = require('../path/to/service');
  const result = await serviceXyz.someMethod();

  Renderer Communication

  // Broadcast to all windows
  sendToRenderer('event-name', data);

  // Send to specific window
  const targetWindow = this.windowPool.get('windowName');
  if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('event-name', data);
  }

  This documentation should enable you to add new shortcuts consistently following the established
  architecture patterns.