const fs = require('fs');
const path = require('path');

const TOP_LEVEL_RUNTIME_FILES = [
    './',
    './about.html',
    './app-snapshot.js',
    './app-utils.js',
    './card-data.mjs',
    './card-renderer.mjs',
    './card-tokenizer.mjs',
    './card-utils.js',
    './campaign-tracker.js',
    './config-manager.js',
    './deck-rules.js',
    './deck-manager.js',
    './deck-flow-utils.js',
    './deckbuilder.js',
    './difficulties.json',
    './dungeons_of_enveron.html',
    './events.js',
    './forbidden_creed.html',
    './index.html',
    './initialization.js',
    './maladumcards.json',
    './manifest.json',
    './live-deck.js',
    './live-deck-session.js',
    './live-deck-view.js',
    './state.js',
    './storage-utils.js',
    './styles.css',
    './ui-manager.js',
    './update-utils.js',
    './version.json'
];

const ASSET_DIRECTORIES = [
    'assets',
    'cardimages',
    'data',
    'icons',
    'logos',
    'vendor'
];

const EXCLUDED_RUNTIME_ASSETS = new Set([
    './data/cards/extraction-report.json'
]);
const EXCLUDED_ASSET_NAMES = new Set(['.DS_Store', 'Thumbs.db']);
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const SERVICE_WORKER_VERSION_REGEX = /^const APP_VERSION = '[^'\r\n]*';$/m;
const ASSET_MANIFEST_REGEX = /(^[ \t]*\/\/ BUILD_ASSET_MANIFEST_START[ \t]*\r?\n)([\s\S]*?)(\r?\n[ \t]*\/\/ BUILD_ASSET_MANIFEST_END[ \t]*$)/m;
const ASSET_MANIFEST_START = '// BUILD_ASSET_MANIFEST_START';
const ASSET_MANIFEST_END = '// BUILD_ASSET_MANIFEST_END';

function loadVersionMetadata(repoRoot) {
    const versionFile = path.join(repoRoot, 'version.json');
    const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
    if (!SEMVER_PATTERN.test(versionData.version || '')) {
        throw new Error(`version.json version must use x.y.z semver, received "${versionData.version}"`);
    }
    return versionData;
}

function collectDirectoryAssets(repoRoot, relativeDir) {
    const directoryPath = path.join(repoRoot, relativeDir);
    if (!fs.existsSync(directoryPath)) {
        return [];
    }

    const assets = [];
    const stack = [directoryPath];

    while (stack.length > 0) {
        const currentPath = stack.pop();
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });

        entries.forEach(entry => {
            const fullPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                return;
            }

            if (EXCLUDED_ASSET_NAMES.has(entry.name)) {
                return;
            }

            const relativePath = './' + path.relative(repoRoot, fullPath).replace(/\\/g, '/');
            if (!EXCLUDED_RUNTIME_ASSETS.has(relativePath)) {
                assets.push(relativePath);
            }
        });
    }

    return assets.sort();
}

function buildAssetManifest(repoRoot) {
    const runtimeFiles = TOP_LEVEL_RUNTIME_FILES.filter(relativePath => {
        if (relativePath === './') {
            return true;
        }
        return fs.existsSync(path.join(repoRoot, relativePath.replace(/^\.\//, '')));
    });

    const directoryAssets = ASSET_DIRECTORIES.flatMap(relativeDir => collectDirectoryAssets(repoRoot, relativeDir));
    return [...new Set([...runtimeFiles, ...directoryAssets])];
}

function syncPackageVersion(repoRoot, version) {
    const packageFile = path.join(repoRoot, 'package.json');
    const packageData = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    packageData.version = version;
    fs.writeFileSync(packageFile, JSON.stringify(packageData, null, 2) + '\n');
}

function syncPackageLockVersion(repoRoot, version) {
    const packageLockFile = path.join(repoRoot, 'package-lock.json');
    if (!fs.existsSync(packageLockFile)) {
        return false;
    }

    const packageLockData = JSON.parse(fs.readFileSync(packageLockFile, 'utf8'));
    if (!packageLockData.packages || !packageLockData.packages['']) {
        throw new Error('package-lock.json is missing its root package metadata');
    }

    packageLockData.version = version;
    packageLockData.packages[''].version = version;
    fs.writeFileSync(packageLockFile, JSON.stringify(packageLockData, null, 2) + '\n');
    return true;
}

function countOccurrences(source, needle) {
    return source.split(needle).length - 1;
}

function renderServiceWorker(serviceWorker, version, assetManifest) {
    const versionMatches = serviceWorker.match(new RegExp(SERVICE_WORKER_VERSION_REGEX.source, 'gm')) || [];
    if (versionMatches.length !== 1) {
        throw new Error('service-worker.js must contain exactly one APP_VERSION marker');
    }
    if (
        countOccurrences(serviceWorker, ASSET_MANIFEST_START) !== 1 ||
        countOccurrences(serviceWorker, ASSET_MANIFEST_END) !== 1 ||
        !ASSET_MANIFEST_REGEX.test(serviceWorker)
    ) {
        throw new Error('service-worker.js must contain exactly one generated asset manifest marker pair');
    }

    const lineEnding = serviceWorker.includes('\r\n') ? '\r\n' : '\n';
    const versionedServiceWorker = serviceWorker.replace(
        SERVICE_WORKER_VERSION_REGEX,
        `const APP_VERSION = '${version}';`
    );
    const renderedManifest = assetManifest.map(asset => `    '${asset}',`).join(lineEnding);

    return versionedServiceWorker.replace(
        ASSET_MANIFEST_REGEX,
        (_match, startMarker, _existingManifest, endMarker) =>
            startMarker + renderedManifest + endMarker
    );
}

function syncServiceWorker(repoRoot, version, assetManifest) {
    const serviceWorkerFile = path.join(repoRoot, 'service-worker.js');
    const serviceWorker = fs.readFileSync(serviceWorkerFile, 'utf8');
    const renderedServiceWorker = renderServiceWorker(serviceWorker, version, assetManifest);
    fs.writeFileSync(serviceWorkerFile, renderedServiceWorker);
}

function syncBuildArtifacts(repoRoot) {
    const { version } = loadVersionMetadata(repoRoot);
    const assetManifest = buildAssetManifest(repoRoot);
    const serviceWorkerFile = path.join(repoRoot, 'service-worker.js');
    const renderedServiceWorker = renderServiceWorker(
        fs.readFileSync(serviceWorkerFile, 'utf8'),
        version,
        assetManifest
    );

    syncPackageVersion(repoRoot, version);
    syncPackageLockVersion(repoRoot, version);
    fs.writeFileSync(serviceWorkerFile, renderedServiceWorker);

    return {
        version,
        assetCount: assetManifest.length
    };
}

if (require.main === module) {
    const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
    const result = syncBuildArtifacts(repoRoot);
    console.log(`Synchronized package metadata and service-worker.js to version ${result.version}`);
    console.log(`Updated service-worker asset manifest with ${result.assetCount} cached URLs`);
}

module.exports = {
    TOP_LEVEL_RUNTIME_FILES,
    buildAssetManifest,
    loadVersionMetadata,
    renderServiceWorker,
    syncBuildArtifacts,
    syncPackageLockVersion,
    syncPackageVersion,
    syncServiceWorker
};
