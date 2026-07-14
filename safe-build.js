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

function runPrisma(command) {
  // Capture output so we can see the real Prisma error when generation fails.
  execSync(command, {
    cwd: workspaceRoot,
    stdio: "pipe",
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=16384" },
  });
}

function killPrismaHolders() {
  // Best-effort: kill node processes that could hold file locks.
  // Ignore all errors to avoid breaking the build on permission failures.
  try {
    // execSync("taskkill /F /IM node.exe /T >NUL 2>&1", {
    //   stdio: "ignore",
    // });
  } catch {}
}

function cleanupPrismaArtifacts() {
  // EPERM here is usually due to file being locked by a previous failed generate.
  try {
    removePath("node_modules/.prisma");
  } catch {}
}

function sleepSeconds(s) {
  try {
    execSync(`timeout /t ${s} /nobreak`, { stdio: "ignore" });
  } catch {}
}

console.log("Starting safe build process...");
console.log("cwd:", workspaceRoot);
backupWorkspace();

try {
  console.log("[1/7] Installing dependencies...");
  run("npm install --no-audit --no-fund");
  console.log("[1/7] npm install finished");

  console.log("[2/7] Building Web (Vite)...");
  run("npx vite build");

  console.log("[3/7] Building Electron (Tsup)...");
  run("npx tsup");

  console.log("[4/7] Generating Prisma client...");

  // Prisma on Windows sometimes fails renaming query_engine while locked.
  // Retry with stronger cleanup between attempts.
  let lastErr;
  for (let i = 0; i < 6; i++) {
    try {
      cleanupPrismaArtifacts();
      killPrismaHolders();
      sleepSeconds(1);

      // Use explicit schema path so it works regardless of cwd quirks.
      // Also capture Prisma logs so we can see the real failure.
      const prismaCmd = "npx prisma generate --schema=./prisma/schema.prisma";
      console.log("Prisma cmd:", prismaCmd);

      // Use inherit so Prisma stdout/stderr is visible live in your terminal.
      execSync(prismaCmd, {
        cwd: workspaceRoot,
        stdio: "inherit",
        env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=16384" },
      });

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

  console.log("[5/7] Preparing bundled node_modules...");
  // Prune devDependencies to keep only production modules
  run("npm prune --omit=dev --no-audit --no-fund");
  
  // Copy the pruned node_modules directly into dist-electron
  // This ensures they are packaged without electron-builder needing to scan them
  if (fs.existsSync("dist-electron/node_modules")) {
    fs.rmSync("dist-electron/node_modules", { recursive: true, force: true });
  }
  fs.cpSync("node_modules", "dist-electron/node_modules", { recursive: true });

  // Temporarily remove dependencies from package.json so electron-builder skips its hanging node_modules check
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  delete pkg.dependencies;
  fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));

  console.log("[6/7] Packaging with electron-builder...");
  // Disable code signing via env vars (no certificate configured)
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
  process.env.WIN_CSC_LINK = "";
  process.env.WIN_CSC_KEY_PASSWORD = "";
  run("npx electron-builder --projectDir .");

  // Re-install dev dependencies so the workspace is ready for development again
  console.log("[7/7] Restoring dev dependencies...");
  run("npm install --no-audit --no-fund");

  console.log("Build completed successfully!");
} catch (error) {
  console.error("Build failed:", error.message);
  process.exitCode = 1;
} finally {
  restoreWorkspace();
  console.log("Restore complete.");
}
