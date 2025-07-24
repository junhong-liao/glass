To disable DevTools (default):
  - Environment variable: SUBLIMINAL_DEVTOOLS=false npm start
  - Config file: Add "devtoolsEnabled": false to
  ~/.subliminal/config.json

To enable DevTools:
  - Environment variable: SUBLIMINAL_DEVTOOLS=true npm start
  - Config file: Add "devtoolsEnabled": true to
  ~/.subliminal/config.json

  The toggle affects all 5 windows: listen, ask, settings,
  shortcut-settings, and header. It only applies in development mode
   (!app.isPackaged) - production builds never show DevTools
  regardless of this setting.