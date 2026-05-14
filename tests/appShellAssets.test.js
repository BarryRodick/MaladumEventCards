/**
 * Test suite for app shell asset integrity
 * Run with: node tests/appShellAssets.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const htmlFiles = [
    'index.html',
    'about.html',
    'dungeons_of_enveron.html',
    'forbidden_creed.html'
];

function extractLocalRefs(html) {
    const refs = [];
    const attributePattern = /(?:href|src)="([^"]+)"/g;
    let match;

    while ((match = attributePattern.exec(html)) !== null) {
        const ref = match[1];
        if (
            ref.startsWith('http://') ||
            ref.startsWith('https://') ||
            ref.startsWith('#') ||
            ref.startsWith('data:')
        ) {
            continue;
        }
        refs.push(ref.split('?')[0]);
    }

    return refs;
}

console.log('Testing app shell asset integrity...');

htmlFiles.forEach(file => {
    const html = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    const refs = extractLocalRefs(html);

    refs.forEach(ref => {
        const absolutePath = path.join(repoRoot, ref);
        assert(fs.existsSync(absolutePath), `${file} references missing local asset ${ref}`);
    });

    assert(!html.includes('https://cdn.jsdelivr.net/'), `${file} should not depend on jsDelivr runtime assets`);
    assert(!html.includes('https://cdnjs.cloudflare.com/'), `${file} should not depend on cdnjs runtime assets`);
    assert(!html.includes('https://fonts.googleapis.com/'), `${file} should not depend on Google Fonts at runtime`);
});

const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
manifest.icons.forEach(icon => {
    const iconPath = path.join(repoRoot, icon.src.replace(/^\.\//, ''));
    assert(fs.existsSync(iconPath), `Manifest icon is missing: ${icon.src}`);
});

const serviceWorker = fs.readFileSync(path.join(repoRoot, 'service-worker.js'), 'utf8');
const updateVersionScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'update-version.js'), 'utf8');
[
    './vendor/bootstrap/css/bootstrap.min.css',
    './vendor/bootstrap/js/bootstrap.bundle.min.js',
    './deck-flow-utils.js',
    './vendor/fontawesome/css/all.min.css',
    './vendor/fonts/cinzel-latin-400-normal.woff2',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
].forEach(asset => {
    assert(serviceWorker.includes(`'${asset}'`), `Service worker asset manifest should include ${asset}`);
});

assert(updateVersionScript.includes("'./deck-flow-utils.js'"),
    'Build asset manifest should include deck-flow-utils.js for future service-worker syncs');

console.log('All app shell asset checks passed!');
