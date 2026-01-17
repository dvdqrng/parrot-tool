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

// Read and modify electron-builder config
const configPath = path.join(__dirname, "..", "electron-builder.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Set artifact name with version
config.artifactName = `\${productName}-\${os}-\${arch}-${fullVersion}.\${ext}`;

// Write temporary config
const tempConfigPath = path.join(__dirname, "..", "electron-builder.temp.json");
fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));

// Run electron-builder with temp config
const args = process.argv.slice(2).join(" ");
try {
  execSync(`electron-builder ${args} --config electron-builder.temp.json`, {
    stdio: "inherit",
    env: { ...process.env },
  });
} finally {
  // Clean up temp config
  if (fs.existsSync(tempConfigPath)) {
    fs.unlinkSync(tempConfigPath);
  }
}
