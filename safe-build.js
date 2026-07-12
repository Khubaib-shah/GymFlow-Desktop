const fs = require("fs");
const { execSync } = require("child_process");

const workspaceRoot = process.cwd();

function removePath(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 1000,
    });
  }
}

function backupFile(fileName) {
  const backupPath = `${fileName}.bak`;
  if (fs.existsSync(fileName)) {
    removePath(backupPath);
    fs.copyFileSync(fileName, backupPath);
  }
}

function restoreFile(fileName) {
  const backupPath = `${fileName}.bak`;
  if (fs.existsSync(backupPath)) {
    removePath(fileName);
    fs.copyFileSync(backupPath, fileName);
    removePath(backupPath);
  }
}

function backupWorkspace() {
  console.log("Backing up workspace manifests before packaging...");
  backupFile("package.json");
  backupFile("package-lock.json");
}

function restoreWorkspace() {
  console.log("Restoring workspace manifests...");
  restoreFile("package.json");
  restoreFile("package-lock.json");
  removePath("node_modules.bak");
}

function run(command) {
  execSync(command, {
    cwd: workspaceRoot,
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=16384" },
  });
}

function killPrismaHolders() {
  // Best-effort: kill node processes that could hold file locks.
  // Ignore all errors to avoid breaking the build on permission failures.
  try {
    execSync("taskkill /F /IM node.exe /T >NUL 2>&1", {
      stdio: "ignore",
    });
  } catch {}
}

function cleanupPrismaArtifacts() {
  // EPERM here is usually due to file being locked by a previous failed generate.
  try {
    removePath("node_modules/.prisma");
  } catch {}
  try {
    removePath("node_modules/@prisma");
  } catch {}
  try {
    removePath("node_modules/.prisma/client");
  } catch {}
}

function sleepSeconds(s) {
  try {
    execSync(`timeout /t ${s} /nobreak`, { stdio: "ignore" });
  } catch {}
}

console.log("Starting safe build process...");
backupWorkspace();

try {
  console.log("Installing dependencies...");
  run("npm install --no-audit --no-fund");

  console.log("Generating Prisma client...");

  // Prisma on Windows sometimes fails renaming query_engine while locked.
  // Retry with stronger cleanup between attempts.
  let lastErr;
  for (let i = 0; i < 6; i++) {
    try {
      cleanupPrismaArtifacts();
      killPrismaHolders();
      sleepSeconds(1);

      run("npx prisma generate --schema=prisma/schema.prisma");
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      console.warn(
        `Prisma generate failed (attempt ${i + 1}/6):`,
        e?.message || String(e),
      );
      cleanupPrismaArtifacts();
      sleepSeconds(2);
    }
  }
  if (lastErr) throw lastErr;

  console.log("Packaging with electron-builder...");
  run("npx electron-builder");

  console.log("Build completed successfully!");
} catch (error) {
  console.error("Build failed:", error.message);
  process.exitCode = 1;
} finally {
  restoreWorkspace();
  console.log("Restore complete.");
}
