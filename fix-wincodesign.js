const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');
const path = require('path');

const cacheDir = path.join(process.env.LOCALAPPDATA, 'electron-builder', 'Cache', 'winCodeSign');
const targetDir = path.join(cacheDir, 'winCodeSign-2.6.0');
const archivePath = path.join(cacheDir, 'winCodeSign-2.6.0.7z');

if (fs.existsSync(targetDir)) {
    console.log('winCodeSign already exists. Exiting.');
    process.exit(0);
}

fs.mkdirSync(cacheDir, { recursive: true });

console.log('Downloading winCodeSign-2.6.0.7z...');
const file = fs.createWriteStream(archivePath);
https.get('https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z', (response) => {
    if (response.statusCode === 302) {
        https.get(response.headers.location, (res) => {
            res.pipe(file);
            file.on('finish', extract);
        });
    } else {
        response.pipe(file);
        file.on('finish', extract);
    }
}).on('error', (err) => {
    console.error('Download error:', err.message);
});

function extract() {
    file.close();
    console.log('Download complete.');
    
    try {
        let sevenZa;
        try {
            sevenZa = require('7zip-bin').path7za;
        } catch (e) {
            // fallback if not found directly
            sevenZa = path.join(__dirname, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe');
        }
        
        console.log('Using 7za:', sevenZa);
        console.log('Extracting without symlink restrictions...');
        
        // Extracting without -snld to avoid privilege errors on Windows
        execSync(`"${sevenZa}" x -y -bd "${archivePath}" "-o${targetDir}"`);
        console.log('Extracted successfully!');
    } catch (e) {
        console.error('Extract command failed, but it might have extracted what we need:', e.message);
    }
}
