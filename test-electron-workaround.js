console.log('Testing workaround...');

// The issue is that require('electron') resolves to node_modules/electron
// We need to use require.resolve to find the built-in module

// Check if process.versions.electron is set (meaning we're inside Electron)
if (process.versions && process.versions.electron) {
  console.log('Running inside Electron:', process.versions.electron);
  
  // Clear the cache for the node_modules/electron to force re-resolution
  try {
    const modulePath = require.resolve('electron');
    console.log('Resolved electron to:', modulePath);
    
    // If it resolved to our local file, delete it from cache
    if (modulePath.includes('node_modules')) {
      delete require.cache[modulePath];
      console.log('Deleted from cache');
    }
  } catch (e) {
    console.log('Could not resolve electron:', e.message);
  }
  
  // Now try to require it again
  try {
    // Use module.constructor._load directly
    const Module = require('module');
    console.log('Module._cache keys containing electron:', 
      Object.keys(Module._cache).filter(k => k.includes('electron')).slice(0, 5));
  } catch (e) {
    console.log('Error:', e.message);
  }
}
