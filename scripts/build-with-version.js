const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Get version components
const pkg = require("../package.json");
const baseVersion = pkg.version;
const timestamp = new Date()
  .toISOString()
  .replace(/[-:T]/g, "")
  .slice(0, 14);
const gitHash = execSync("git rev-parse --short HEAD").toString().trim();

// Build full version string: v0.1.0-20260116185624-064d1b3
const fullVersion = `${baseVersion}-${timestamp}-${gitHash}`;

console.log(`Building version: ${fullVersion}`);
console.log(`Platform: ${process.platform}`);

// Read and modify electron-builder config
const configPath = path.join(__dirname, "..", "electron-builder.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Set artifact name with version
config.artifactName = `\${productName}-\${os}-\${arch}-${fullVersion}.\${ext}`;

// Remove built-in notarize option - we use afterAllArtifactBuild for DMG notarization
// Having both causes conflicts and potential failures
if (config.mac) {
  delete config.mac.notarize;
  console.log("Using custom notarization via afterAllArtifactBuild hook");
}

// Write temporary config
const tempConfigPath = path.join(__dirname, "..", "electron-builder.temp.json");
fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));

// Determine platform flags
let platformArgs = "";
if (process.platform === "darwin") {
  platformArgs = "--mac";
  console.log("Building for macOS (x64 and arm64)");
} else if (process.platform === "win32") {
  platformArgs = "--win";
  console.log("Building for Windows");
} else if (process.platform === "linux") {
  platformArgs = "--linux";
  console.log("Building for Linux");
}

// Run electron-builder with temp config
const additionalArgs = process.argv.slice(2).join(" ");
const fullCommand = `electron-builder ${platformArgs} ${additionalArgs} --config electron-builder.temp.json`.trim();
console.log(`Running: ${fullCommand}`);

try {
  execSync(fullCommand, {
    stdio: "inherit",
    env: { ...process.env },
  });
} finally {
  // Clean up temp config
  if (fs.existsSync(tempConfigPath)) {
    fs.unlinkSync(tempConfigPath);
  }
}
