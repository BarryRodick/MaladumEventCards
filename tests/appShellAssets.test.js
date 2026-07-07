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
const googleAnalyticsId = 'G-ZMTSM9B7Q7';

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

function extractCssLocalRefs(css) {
    const refs = [];
    const urlPattern = /url\((['"]?)([^'")]+)\1\)/g;
    let match;

    while ((match = urlPattern.exec(css)) !== null) {
        const ref = match[2];
        if (
            ref.startsWith('http://') ||
            ref.startsWith('https://') ||
            ref.startsWith('data:') ||
            ref.startsWith('#') ||
            ref.startsWith('%23')
        ) {
            continue;
        }
        refs.push(ref.split('?')[0].replace(/^\.\//, ''));
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
    assert(
        html.includes(`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`),
        `${file} should load the Google Analytics tag`
    );
    assert(
        html.includes(`gtag('config', '${googleAnalyticsId}'`),
        `${file} should configure the Google Analytics measurement ID`
    );
    assert(
        !html.includes('transport_url'),
        `${file} should not override Google Analytics transport routing`
    );
});

const styles = fs.readFileSync(path.join(repoRoot, 'styles.css'), 'utf8');
extractCssLocalRefs(styles).forEach(ref => {
    const absolutePath = path.join(repoRoot, ref);
    assert(fs.existsSync(absolutePath), `styles.css references missing local asset ${ref}`);
});

const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'manifest.json'), 'utf8'));
manifest.icons.forEach(icon => {
    const iconPath = path.join(repoRoot, icon.src.replace(/^\.\//, ''));
    assert(fs.existsSync(iconPath), `Manifest icon is missing: ${icon.src}`);
});

const serviceWorker = fs.readFileSync(path.join(repoRoot, 'service-worker.js'), 'utf8');
const updateVersionScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'update-version.js'), 'utf8');
[
    './app-snapshot.js',
    './campaign-tracker.js',
    './assets/ui/campaign-divider.svg',
    './assets/ui/dark-surface-texture.svg',
    './assets/ui/parchment-panel-texture.svg',
    './vendor/bootstrap/css/bootstrap.min.css',
    './vendor/bootstrap/js/bootstrap.bundle.min.js',
    './deck-flow-utils.js',
    './deck-rules.js',
    './live-deck.js',
    './vendor/fontawesome/css/all.min.css',
    './vendor/fonts/cinzel-latin-400-normal.woff2',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
].forEach(asset => {
    assert(serviceWorker.includes(`'${asset}'`), `Service worker asset manifest should include ${asset}`);
});

assert(updateVersionScript.includes("'./deck-flow-utils.js'"),
    'Build asset manifest should include deck-flow-utils.js for future service-worker syncs');
assert(updateVersionScript.includes("'./deck-rules.js'"),
    'Build asset manifest should include deck-rules.js for future service-worker syncs');
assert(updateVersionScript.includes("'./live-deck.js'"),
    'Build asset manifest should include live-deck.js for future service-worker syncs');
assert(updateVersionScript.includes("'./app-snapshot.js'"),
    'Build asset manifest should include app-snapshot.js for future service-worker syncs');
assert(updateVersionScript.includes("'./campaign-tracker.js'"),
    'Build asset manifest should include campaign-tracker.js for future service-worker syncs');
assert(updateVersionScript.includes("'assets'"),
    'Build asset manifest should scan the assets directory for future service-worker syncs');

console.log('All app shell asset checks passed!');
