const fs = require('fs');
const { execSync } = require('child_process');

console.log('Starting safe build process...');

// 1. Save original files
console.log('Backing up package.json and node_modules...');
fs.copyFileSync('package.json', 'package.json.bak');
if (fs.existsSync('package-lock.json')) fs.copyFileSync('package-lock.json', 'package-lock.json.bak');

// 2. Create slim package.json
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
delete pkg.devDependencies;
// Keep scripts that don't interfere, but remove dev ones just in case
pkg.scripts = { build: "electron-builder" };
pkg.build.electronVersion = "42.3.0"; // Provide explicit electron version
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

// 3. Rename node_modules to hide it
if (fs.existsSync('node_modules')) {
  fs.renameSync('node_modules', 'node_modules.bak');
}

try {
  // 4. Install only prod dependencies
  console.log('Installing pure production dependencies...');
  execSync('npm install --production --no-audit --no-fund', { stdio: 'inherit' });

  // 4.1. Generate Prisma client because npm install --production doesn't do it automatically!
  console.log('Generating Prisma client...');
  execSync('npx --yes prisma@5 generate', { stdio: 'inherit' });

  // 4.5. Hide node_modules from electron-builder's built-in exclusion rules
  // by copying it inside dist-electron, so it's treated as normal app files!
  fs.cpSync('node_modules', 'dist-electron/node_modules', { recursive: true });
  try {
    fs.rmSync('node_modules', { recursive: true, force: true });
  } catch(e) { console.warn("Failed to delete node_modules:", e.message) }

  pkg.dependencies = {};
  pkg.build.asarUnpack = [
    "prisma/**/*",
    "dist-electron/node_modules/.prisma/client/*.exe",
    "dist-electron/node_modules/.prisma/client/*.dll",
    "dist-electron/node_modules/.prisma/client/*.node",
    "dist-electron/node_modules/@prisma/engines/**/*.exe",
    "dist-electron/node_modules/@prisma/engines/**/*.dll",
    "dist-electron/node_modules/@prisma/engines/**/*.node"
  ];
  pkg.build.files = [
    "dist/**/*",
    "dist-electron/**/*",
    "prisma/**/*"
  ];
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

  // 5. Run electron-builder
  console.log('Packaging with electron-builder...');
  execSync('npx electron-builder', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max_old_space_size=8192' } });
  
  console.log('Build completed successfully!');

} catch (error) {
  console.error('Build failed:', error.message);
} finally {
  // 6. Restore everything
  console.log('Restoring development environment...');
  if (fs.existsSync('dist-electron/node_modules')) {
    fs.rmSync('dist-electron/node_modules', { recursive: true, force: true });
  }
  if (fs.existsSync('node_modules')) {
    fs.rmSync('node_modules', { recursive: true, force: true });
  }
  if (fs.existsSync('node_modules.bak')) {
    fs.renameSync('node_modules.bak', 'node_modules');
  }
  fs.renameSync('package.json.bak', 'package.json');
  if (fs.existsSync('package-lock.json.bak')) {
    fs.renameSync('package-lock.json.bak', 'package-lock.json');
  }
  console.log('Restore complete.');
}
