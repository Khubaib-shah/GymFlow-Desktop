/**
 * GymFlow Production Build
 *
 * Strategy:
 * 1. Build all code with full dev dependencies (vite, tsup, etc.)
 * 2. Delete node_modules
 * 3. Production-only install (npm install --production)
 * 4. Install electron-builder separately (as a standalone package)
 * 5. Package with minimal node_modules
 * 6. Restore everything
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.cwd();
const NODE_OPTS = { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' };

function run(cmd, label) {
    console.log(`\n[${label}] Running: ${cmd}`);
    execSync(cmd, { cwd: root, stdio: 'inherit', env: NODE_OPTS });
}

function runCapture(cmd) {
    return execSync(cmd, { cwd: root, stdio: 'pipe', encoding: 'utf-8' });
}

console.log('========================================');
console.log('  GymFlow Production Build');
console.log('========================================\n');

try {
    // === PHASE 1: BUILD (with full dev deps) ===
    run('npx vite build', '1/6 Build Web');
    run('npx tsup', '2/6 Build Electron');
    run('npx prisma generate --schema=./prisma/schema.prisma', '3/6 Prisma Client');

    // Save current package.json for restoration
    const origPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
    const pkgBackup = path.join(root, 'package.json.prodbackup');
    fs.writeFileSync(pkgBackup, JSON.stringify(origPkg, null, 2));

    // === PHASE 2: PRODUCTION-ONLY INSTALL ===
    console.log('\n[4/6] Switching to production dependencies...');

    // Remove full node_modules (the 700+ packages causing memory issues)
    const nmDir = path.join(root, 'node_modules');
    if (fs.existsSync(nmDir)) {
        console.log('  Removing full node_modules (700+ packages)...');
        runCapture(`rmdir /s /q "${nmDir}"`);
    }

    // Save only production deps + electron + electron-builder in package.json
    const prodPkg = {
        name: origPkg.name,
        version: origPkg.version,
        description: 'Gym Management System',
        author: origPkg.author,
        main: origPkg.main,
        dependencies: origPkg.dependencies,
        devDependencies: {
            'electron': origPkg.devDependencies['electron'],
            'electron-builder': origPkg.devDependencies['electron-builder']
        },
        // Include build config inline so we don't need electron-builder.yml
        build: {
            appId: 'com.gymflow.desktop',
            productName: 'GymFlow',
            copyright: 'Copyright © 2026 Khubaib Shah',
            directories: { output: 'release', buildResources: 'build' },
            files: [
                'dist/**/*',
                'dist-electron/**/*',
                'package.json',
                '!node_modules/**/*',
                'node_modules/@prisma/client/**/*',
                'node_modules/.prisma/client/**/*',
                'node_modules/sqlite3/**/*',
                'node_modules/bcryptjs/**/*',
                'node_modules/node-zklib/**/*',
                'node_modules/digest-fetch/**/*'
            ],
            extraResources: [
                { from: 'prisma/dev.db', to: 'dev.db' },
                { from: 'prisma/schema.prisma', to: 'schema.prisma' }
            ],
            asarUnpack: [
                '**/*.node',
                'node_modules/.prisma/**/*',
                'node_modules/@prisma/**/*',
                'node_modules/sqlite3/**/*'
            ],
            win: {
                target: [{ target: 'nsis', arch: ['x64'] }],
                artifactName: 'GymFlow-${version}-Setup.${ext}',
            },
            nsis: {
                oneClick: false,
                allowToChangeInstallationDirectory: true,
                createDesktopShortcut: true,
                createStartMenuShortcut: true,
                shortcutName: 'GymFlow',
                deleteAppDataOnUninstall: false
            },
            npmRebuild: false,
            nodeGypRebuild: false,
            compression: 'normal',
            publish: null,
            electronVersion: '42.6.1'
        }
    };
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(prodPkg, null, 2));

    // Install ONLY production dependencies (no react, no radix, no vite, etc.)
    console.log('  Installing production dependencies...');
    run('npm install --production --no-audit --no-fund --ignore-scripts', '5/6 Install Production');

    // Now install electron-builder on top (we need it for packaging)
    // Using --save-dev to keep it in devDependencies
    console.log('  Installing electron-builder for packaging...');
    run('npm install --save-dev electron electron-builder --no-audit --no-fund --ignore-scripts', '5b/6 Install Builder');

    // === PHASE 3: PACKAGE ===
    console.log('\n[6/6] Packaging with electron-builder...');
    run('npx electron-builder', '6/6 Package');

    console.log('\n========================================');
    console.log('  Build completed successfully!');
    console.log('  Check the release/ directory for the installer.');
    console.log('========================================\n');
} catch (err) {
    console.error('\nBuild failed:', err.message);
    process.exitCode = 1;
} finally {
    // Full restore
    console.log('\nRestoring development environment...');
    try {
        const nm = path.join(root, 'node_modules');
        if (fs.existsSync(nm)) runCapture(`rmdir /s /q "${nm}"`);
    } catch { }
    // Restore from backup
    const pkgBackup = path.join(root, 'package.json.prodbackup');
    try {
        if (fs.existsSync(pkgBackup)) {
            const restored = JSON.parse(fs.readFileSync(pkgBackup, 'utf-8'));
            fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(restored, null, 2));
            fs.unlinkSync(pkgBackup);
        }
    } catch { }
    // Full npm install to restore everything
    try {
        execSync('npm install', { cwd: root, stdio: 'inherit', env: NODE_OPTS });
        console.log('Development environment fully restored.');
    } catch (e) {
        console.error('Failed to restore dev environment:', e.message);
    }
}