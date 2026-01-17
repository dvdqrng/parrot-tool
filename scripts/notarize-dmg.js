const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

exports.default = async function notarizeDmg(context) {
  if (process.platform !== "darwin") {
    console.log("Skipping DMG notarization - not on macOS");
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.log("Skipping DMG notarization - missing credentials");
    return;
  }

  const dmgFiles = context.artifactPaths.filter((p) => p.endsWith(".dmg"));

  for (const dmgPath of dmgFiles) {
    if (!fs.existsSync(dmgPath)) {
      console.log(`DMG not found: ${dmgPath}`);
      continue;
    }

    console.log(`Notarizing DMG: ${path.basename(dmgPath)}`);

    try {
      execSync(
        `xcrun notarytool submit "${dmgPath}" --apple-id "${appleId}" --password "${appleIdPassword}" --team-id "${teamId}" --wait`,
        { stdio: "inherit" }
      );

      console.log(`Stapling DMG: ${path.basename(dmgPath)}`);
      execSync(`xcrun stapler staple "${dmgPath}"`, { stdio: "inherit" });

      console.log(`DMG notarization complete: ${path.basename(dmgPath)}`);
    } catch (error) {
      console.error(`Failed to notarize DMG: ${error.message}`);
      throw error;
    }
  }
};
