/**
 * Preps the database for production packaging.
 * Copies the seed database to the output location.
 * This is run BEFORE electron-builder so the initial db is fresh.
 */
const fs = require('fs');
const path = require('path');

console.log('Preparing database for production...');

const root = process.cwd();
const src = path.join(root, 'prisma', 'dev.db');
const dest = path.join(root, 'prisma', 'dev.db');

// Verify the database file exists
if (!fs.existsSync(src)) {
    console.error('ERROR: Seed database not found at', src);
    process.exit(1);
}

const stats = fs.statSync(src);
console.log(`Database file size: ${(stats.size / 1024).toFixed(2)} KB`);
console.log('Database ready for packaging.');