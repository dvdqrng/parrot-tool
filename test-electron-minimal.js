console.log('Test script starting...');
console.log('__dirname:', __dirname);

try {
  const electron = require('electron');
  console.log('require("electron") returned:', typeof electron);
  console.log('electron keys:', Object.keys(electron).slice(0, 10));
  
  const { app, BrowserWindow } = electron;
  console.log('app:', typeof app);
  console.log('BrowserWindow:', typeof BrowserWindow);
  
  if (app && app.whenReady) {
    app.whenReady().then(() => {
      console.log('App ready! isPackaged:', app.isPackaged);
      app.quit();
    });
  } else {
    console.log('app.whenReady not available');
    process.exit(1);
  }
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
