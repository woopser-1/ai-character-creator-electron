/**
 * electron-builder afterSign hook.
 *
 * We don't have an Apple Developer ID, so the build is unsigned by default.
 * On Apple Silicon, the kernel refuses to launch a binary that has *no*
 * signature at all — it needs at least an ad-hoc signature. So we apply one
 * here. This does NOT make Gatekeeper happy on its own (the app will still
 * be quarantined on first download from the internet), but it ensures the
 * binary is technically launchable once the user removes the quarantine
 * attribute. See README — "Installing on macOS".
 */

const { execSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  console.log(`[afterSign] ad-hoc signing ${appPath}`);
  try {
    execSync(`codesign --force --deep --sign - "${appPath}"`, {
      stdio: "inherit",
    });
    console.log("[afterSign] ad-hoc signature applied");
  } catch (err) {
    console.error("[afterSign] codesign failed:", err.message);
    throw err;
  }
};
