const { app, BrowserWindow, Menu, shell, nativeTheme } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const port = process.env.PORT || 3000;

let mainWindow;
let nextServer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#262625' : '#f5f5f4',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false, // Don't show until ready
  });

  // Show window when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load the app
  const loadURL = `http://localhost:${port}`;

  mainWindow.loadURL(loadURL).catch((err) => {
    console.error('Failed to load URL:', err);
    // Retry after a short delay (useful during server startup)
    setTimeout(() => {
      mainWindow.loadURL(loadURL).catch(console.error);
    }, 1000);
  });

  // Open DevTools only in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Update background color when system theme changes
  nativeTheme.on('updated', () => {
    if (mainWindow) {
      mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#262625' : '#f5f5f4');
    }
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ];

  // Add macOS-specific app menu
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function startNextServer() {
  return new Promise((resolve, reject) => {
    console.log('Starting Next.js server...');

    // Set environment variables for the server
    process.env.NODE_ENV = isDev ? 'development' : 'production';
    process.env.PORT = port.toString();

    try {
      // Directly require the server.js module instead of spawning it
      // This works correctly in packaged apps where node binary isn't available
      const serverPath = path.join(__dirname, 'server.js');
      require(serverPath);

      // Give the server time to start
      const startupTime = isDev ? 8000 : 4000;
      setTimeout(resolve, startupTime);
    } catch (err) {
      console.error('Failed to start Next.js server:', err);
      reject(err);
    }
  });
}

app.whenReady().then(async () => {
  createMenu();

  try {
    // Start Next.js server if in production or if not already running
    if (!isDev) {
      await startNextServer();
    }

    createWindow();
  } catch (err) {
    console.error('Failed to start application:', err);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Kill Next.js server when app quits
  if (nextServer) {
    nextServer.kill();
  }
});

// Handle process errors gracefully
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
