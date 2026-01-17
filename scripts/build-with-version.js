const { execSync } = require("child_process");

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

// Build artifact name pattern - electron-builder template variables
const artifactName = '${productName}-${os}-${arch}-' + fullVersion + '.${ext}';

// Run electron-builder with the custom version in artifact name
const args = process.argv.slice(2).join(" ");
execSync(
  `electron-builder ${args} -c.artifactName="${artifactName}"`,
  {
    stdio: "inherit",
    env: {
      ...process.env,
    },
  }
);
