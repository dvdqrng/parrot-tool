console.log('=== Electron Debug Script ===');
console.log('Node version:', process.versions.node);
console.log('Electron version:', process.versions.electron);
console.log('Chrome version:', process.versions.chrome);
console.log('');

// Check if we're in the main process
console.log('process.type:', process.type);

// Try requiring electron
const electronModule = require('electron');
console.log('typeof require("electron"):', typeof electronModule);

if (typeof electronModule === 'string') {
  console.log('ERROR: require("electron") returned a string:', electronModule);
  console.log('This means the npm electron package is being loaded instead of the built-in electron module');
} else {
  console.log('require("electron") returned an object with keys:', Object.keys(electronModule).slice(0, 20));
}
