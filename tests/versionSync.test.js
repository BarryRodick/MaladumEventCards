/**
 * Test suite for build/version sync helpers
 * Run with: node tests/versionSync.test.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    loadVersionMetadata,
    syncPackageLockVersion,
    syncPackageVersion,
    syncServiceWorker
} = require('../scripts/update-version.js');

console.log('Testing version sync helpers...');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'maladum-version-sync-'));

try {
    fs.writeFileSync(path.join(tempRoot, 'version.json'), JSON.stringify({
        version: '9.8.7',
        lastUpdated: '2026-04-12'
    }, null, 2));

    fs.writeFileSync(path.join(tempRoot, 'package.json'), JSON.stringify({
        name: 'temp-package',
        version: '0.0.1'
    }, null, 2));

    fs.writeFileSync(path.join(tempRoot, 'package-lock.json'), JSON.stringify({
        name: 'temp-package',
        version: '0.0.1',
        lockfileVersion: 3,
        packages: {
            '': {
                name: 'temp-package',
                version: '0.0.1'
            }
        }
    }, null, 2));

    fs.writeFileSync(path.join(tempRoot, 'service-worker.js'), [
        "const APP_VERSION = '0.0.1';",
        'const urlsToCache = [',
        '    // BUILD_ASSET_MANIFEST_START',
        "    './old-file.js',",
        '    // BUILD_ASSET_MANIFEST_END',
        '];'
    ].join('\n'));

    const { version } = loadVersionMetadata(tempRoot);
    syncPackageVersion(tempRoot, version);
    syncPackageLockVersion(tempRoot, version);
    syncServiceWorker(tempRoot, version, ['./index.html', './vendor/bootstrap/css/bootstrap.min.css']);

    const packageData = JSON.parse(fs.readFileSync(path.join(tempRoot, 'package.json'), 'utf8'));
    const packageLockData = JSON.parse(fs.readFileSync(path.join(tempRoot, 'package-lock.json'), 'utf8'));
    const serviceWorker = fs.readFileSync(path.join(tempRoot, 'service-worker.js'), 'utf8');

    assert.strictEqual(packageData.version, '9.8.7',
        'package.json version should be synchronized from version.json');
    assert.strictEqual(packageLockData.version, '9.8.7',
        'package-lock.json version should be synchronized from version.json');
    assert.strictEqual(packageLockData.packages[''].version, '9.8.7',
        'package-lock.json root package version should be synchronized from version.json');
    assert(serviceWorker.includes("const APP_VERSION = '9.8.7';"),
        'service worker version should be synchronized from version.json');
    assert(serviceWorker.includes("'./index.html'"),
        'service worker asset manifest should contain generated runtime URLs');
    assert(serviceWorker.includes("'./vendor/bootstrap/css/bootstrap.min.css'"),
        'service worker asset manifest should contain vendored runtime assets');

    const malformedServiceWorkerFile = path.join(tempRoot, 'service-worker.js');
    const missingVersionMarker = serviceWorker.replace("const APP_VERSION = '9.8.7';", '// version marker removed');
    fs.writeFileSync(malformedServiceWorkerFile, missingVersionMarker);
    assert.throws(
        () => syncServiceWorker(tempRoot, version, ['./index.html']),
        /APP_VERSION marker/,
        'version sync should fail closed when the APP_VERSION marker is missing'
    );
    assert.strictEqual(
        fs.readFileSync(malformedServiceWorkerFile, 'utf8'),
        missingVersionMarker,
        'failed version sync should not rewrite a malformed service worker'
    );

    const missingManifestMarker = serviceWorker.replace('// BUILD_ASSET_MANIFEST_END', '// marker removed');
    fs.writeFileSync(malformedServiceWorkerFile, missingManifestMarker);
    assert.throws(
        () => syncServiceWorker(tempRoot, version, ['./index.html']),
        /asset manifest marker pair/,
        'version sync should fail closed when generated-manifest markers are missing'
    );
    assert.strictEqual(
        fs.readFileSync(malformedServiceWorkerFile, 'utf8'),
        missingManifestMarker,
        'failed manifest sync should not rewrite a malformed service worker'
    );
} finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('All version sync helper tests passed!');
