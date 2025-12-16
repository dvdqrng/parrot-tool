const { app, BrowserWindow } = require('electron');

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
  });

  // Make sure to run `npm run dev` in a separate terminal
  // before running this Electron script.
  mainWindow.loadURL('http://localhost:3000');
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
