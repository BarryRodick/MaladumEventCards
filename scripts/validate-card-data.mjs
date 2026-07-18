import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateCardManifest, validateIconManifest, validateRichCardRecord } from '../card-schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const cardsRoot = path.join(repoRoot, 'data', 'cards');

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

async function main() {
    const manifest = await loadJson(path.join(cardsRoot, 'manifest.json'));
    const icons = await loadJson(path.join(cardsRoot, 'icons.json'));
    const errors = [
        ...validateCardManifest(manifest),
        ...validateIconManifest(icons)
    ];

    const seenIds = new Set();
    let cardCount = 0;

    for (const [gameName, relativePath] of Object.entries(manifest.games || {})) {
        const absolutePath = path.join(repoRoot, relativePath);
        if (!(await fileExists(absolutePath))) {
            errors.push({
                path: `manifest.games.${gameName}`,
                message: `Game file not found: ${relativePath}`
            });
            continue;
        }

        const payload = await loadJson(absolutePath);
        const cards = Array.isArray(payload) ? payload : (payload.cards || []);

        cards.forEach((card, index) => {
            cardCount++;
            validateRichCardRecord(card, `${gameName}[${index}]`).forEach(error => errors.push(error));

            if (seenIds.has(card.id)) {
                errors.push({
                    path: `${gameName}[${index}].id`,
                    message: `Duplicate rich card id ${card.id}`
                });
            } else {
                seenIds.add(card.id);
            }

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

    if (errors.length > 0) {
        errors.forEach(error => {
            console.error(`${error.path}: ${error.message}`);
        });
        process.exitCode = 1;
        return;
    }

    console.log(`Validated ${cardCount} rich cards across ${Object.keys(manifest.games || {}).length} game files.`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
