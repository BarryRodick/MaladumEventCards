const fs = require('fs');
const path = require('path');

const TOP_LEVEL_RUNTIME_FILES = [
  './',
  './about.html',
  './app-utils.js',
  './card-actions.js',
  './card-data.mjs',
  './card-renderer.mjs',
  './card-tokenizer.mjs',
  './card-utils.js',
  './config-manager.js',
  './deck-manager.js',
  './deckbuilder.js',
  './difficulties.json',
  './dungeons_of_enveron.html',
  './events.js',
  './forbidden_creed.html',
  './index.html',
  './initialization.js',
  './maladumcards.json',
  './manifest.json',
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

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const SERVICE_WORKER_VERSION_REGEX = /const APP_VERSION = '.*?';/;
const ASSET_MANIFEST_REGEX = /(\/\/ BUILD_ASSET_MANIFEST_START\r?\n)([\s\S]*?)(\r?\n    \/\/ BUILD_ASSET_MANIFEST_END)/;

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

      if (entry.name === 'Thumbs.db') {
        return;
      }

      const relativePath = './' + path.relative(repoRoot, fullPath).replace(/\\/g, '/');
      assets.push(relativePath);
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

function syncServiceWorker(repoRoot, version, assetManifest) {
  const serviceWorkerFile = path.join(repoRoot, 'service-worker.js');
  let serviceWorker = fs.readFileSync(serviceWorkerFile, 'utf8');
  const lineEnding = serviceWorker.includes('\r\n') ? '\r\n' : '\n';

  serviceWorker = serviceWorker.replace(SERVICE_WORKER_VERSION_REGEX, `const APP_VERSION = '${version}';`);

  const renderedManifest = assetManifest.map(asset => `    '${asset}',`).join(lineEnding);
  serviceWorker = serviceWorker.replace(
    ASSET_MANIFEST_REGEX,
    `$1${renderedManifest}$3`
  );

  fs.writeFileSync(serviceWorkerFile, serviceWorker);
}

function syncBuildArtifacts(repoRoot) {
  const { version } = loadVersionMetadata(repoRoot);
  const assetManifest = buildAssetManifest(repoRoot);

  syncPackageVersion(repoRoot, version);
  syncServiceWorker(repoRoot, version, assetManifest);

  return {
    version,
    assetCount: assetManifest.length
  };
}

if (require.main === module) {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..');
  const result = syncBuildArtifacts(repoRoot);
  console.log(`Synchronized package.json and service-worker.js to version ${result.version}`);
  console.log(`Updated service-worker asset manifest with ${result.assetCount} cached URLs`);
}

module.exports = {
  buildAssetManifest,
  loadVersionMetadata,
  syncBuildArtifacts,
  syncPackageVersion,
  syncServiceWorker
};
