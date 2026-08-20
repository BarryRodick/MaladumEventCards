import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assessCardCatalog } from '../card-catalog-policy.mjs';
import { validateCardManifest, validateIconManifest, validateRichCardRecord } from '../card-schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRepoRoot = path.resolve(__dirname, '..');

async function loadJson(filePath) {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function policyError(reason) {
    const values = reason.values && Object.keys(reason.values).length > 0
        ? ` ${JSON.stringify(reason.values)}`
        : '';
    return {
        path: reason.path || reason.code,
        message: `${reason.code}${values}`
    };
}

export async function assessCheckedInCardCatalog(repoRoot = defaultRepoRoot) {
    const cardsRoot = path.join(repoRoot, 'data', 'cards');
    const legacyCatalog = await loadJson(path.join(repoRoot, 'maladumcards.json'));
    const difficultiesPayload = await loadJson(path.join(repoRoot, 'difficulties.json'));
    const manifest = await loadJson(path.join(cardsRoot, 'manifest.json'));
    const icons = await loadJson(path.join(cardsRoot, 'icons.json'));
    const errors = [
        ...validateCardManifest(manifest),
        ...validateIconManifest(icons)
    ];
    const richGames = {};
    const gameSources = {};
    let cardCount = 0;

    for (const [gameName, relativePath] of Object.entries(manifest.games || {})) {
        const absolutePath = path.join(repoRoot, relativePath);
        if (!(await fileExists(absolutePath))) {
            errors.push({
                path: `manifest.games.${gameName}`,
                message: `Game file not found: ${relativePath}`
            });
            gameSources[gameName] = { status: 'failure', path: relativePath };
            continue;
        }

        const payload = await loadJson(absolutePath);
        const cards = Array.isArray(payload) ? payload : (payload.cards || []);
        richGames[gameName] = payload;
        gameSources[gameName] = { status: 'success', path: relativePath, value: payload };
        cardCount += cards.length;

        cards.forEach((card, index) => {
            validateRichCardRecord(card, `${gameName}[${index}]`).forEach(error => errors.push(error));
        });

        for (const [index, card] of cards.entries()) {
            const sourceImagePath = path.join(repoRoot, 'cardimages', card.sourceImage || '');
            if (!card.sourceImage || !(await fileExists(sourceImagePath))) {
                errors.push({
                    path: `${gameName}[${index}].sourceImage`,
                    message: `Missing source image ${card.sourceImage || '(empty)'}`
                });
            }
        }
    }

    for (const [name, entry] of Object.entries(icons)) {
        const assetPath = path.join(repoRoot, entry.asset || '');
        if (!(await fileExists(assetPath))) {
            errors.push({
                path: `icons.${name}.asset`,
                message: `Icon asset not found: ${entry.asset}`
            });
        }
    }

    const candidate = {
        legacyCatalog,
        difficultiesPayload,
        richCatalog: { manifest, icons, games: richGames },
        sources: {
            legacy: { status: 'success', path: 'maladumcards.json', value: legacyCatalog },
            difficulties: { status: 'success', path: 'difficulties.json', value: difficultiesPayload },
            manifest: { status: 'success', path: 'data/cards/manifest.json', value: manifest },
            icons: { status: 'success', path: 'data/cards/icons.json', value: icons },
            games: gameSources
        }
    };
    const decision = assessCardCatalog({ candidate, profile: 'checked-in' });
    if (!decision.checkedIn.accepted) {
        decision.reasons.forEach(reason => errors.push(policyError(reason)));
    }

    return {
        errors,
        cardCount,
        gameCount: Object.keys(manifest.games || {}).length,
        decision
    };
}

async function main() {
    const result = await assessCheckedInCardCatalog();
    if (result.errors.length > 0) {
        result.errors.forEach(error => console.error(`${error.path}: ${error.message}`));
        process.exitCode = 1;
        return;
    }
    console.log(`Validated ${result.cardCount} rich cards across ${result.gameCount} game files.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
