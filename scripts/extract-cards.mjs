import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { normalizeCard, slugifyCardText } from '../card-data.mjs';
import { validateRichCardRecord } from '../card-schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const cardsRoot = path.join(repoRoot, 'data', 'cards');

export const REGION_LAYOUT = {
    title: { x: 0.08, y: 0.03, width: 0.84, height: 0.11 },
    primaryHeader: { x: 0.10, y: 0.17, width: 0.80, height: 0.07 },
    primaryBody: { x: 0.09, y: 0.23, width: 0.82, height: 0.24 },
    midBox: { x: 0.08, y: 0.46, width: 0.84, height: 0.12 },
    secondaryHeader: { x: 0.10, y: 0.58, width: 0.80, height: 0.07 },
    secondaryBody: { x: 0.09, y: 0.64, width: 0.82, height: 0.20 },
    footerLeft: { x: 0.07, y: 0.83, width: 0.26, height: 0.13 },
    footerRight: { x: 0.36, y: 0.82, width: 0.56, height: 0.14 }
};

function parseArgs(argv) {
    const args = new Set(argv.slice(2));
    const limitArg = argv.find(arg => arg.startsWith('--limit='));
    const gameArg = argv.find(arg => arg.startsWith('--game='));

    return {
        force: args.has('--force'),
        ocr: args.has('--ocr'),
        ocrBody: args.has('--ocr-body'),
        limit: limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : null,
        gameFilter: gameArg ? gameArg.split('=').slice(1).join('=').trim() : null
    };
}

function round(value, digits = 4) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

export function toGameFileName(gameName) {
    return `${slugifyCardText(gameName)}.json`;
}

async function loadJson(filePath) {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function toPixelRegion(layout, width, height) {
    return {
        left: Math.max(0, Math.round(layout.x * width)),
        top: Math.max(0, Math.round(layout.y * height)),
        width: Math.max(1, Math.round(layout.width * width)),
        height: Math.max(1, Math.round(layout.height * height))
    };
}

function cleanupOcrText(text = '') {
    return String(text)
        .replace(/[|]/g, 'I')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .trim();
}

export function titlesRoughlyMatch(left = '', right = '') {
    const normalize = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
    return normalize(left) === normalize(right);
}

async function regionStats(imagePath, region) {
    const buffer = await sharp(imagePath)
        .extract(region)
        .grayscale()
        .normalize()
        .png()
        .toBuffer();

    const stats = await sharp(buffer).stats();
    return {
        buffer,
        channelStats: stats.channels[0]
    };
}

let workerState = null;

async function getOcrWorker() {
    if (workerState) {
        return workerState;
    }

    const { createWorker, PSM } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, {
        logger: () => {}
    });
    workerState = { worker, PSM };
    return workerState;
}

async function recognizeText(buffer, psmMode) {
    const { worker, PSM } = await getOcrWorker();
    await worker.setParameters({
        tessedit_pageseg_mode: psmMode ?? PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1'
    });
    const result = await worker.recognize(buffer);

    return {
        text: cleanupOcrText(result.data.text || ''),
        confidence: round((result.data.confidence || 0) / 100, 4)
    };
}

async function closeOcrWorker() {
    if (!workerState?.worker) {
        return;
    }

    await workerState.worker.terminate();
    workerState = null;
}

async function inspectSourceImage(imagePath, options) {
    const metadata = await sharp(imagePath).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const regions = Object.fromEntries(
        Object.entries(REGION_LAYOUT).map(([name, layout]) => [name, toPixelRegion(layout, width, height)])
    );

    const footerLeft = await regionStats(imagePath, regions.footerLeft);
    const footerRight = await regionStats(imagePath, regions.footerRight);
    const title = await regionStats(imagePath, regions.title);
    const primaryHeader = await regionStats(imagePath, regions.primaryHeader);
    const secondaryHeader = await regionStats(imagePath, regions.secondaryHeader);

    const insights = {
        width,
        height,
        regions,
        footerLeftHasContent: footerLeft.channelStats.stdev > 18,
        footerRightHasContent: footerRight.channelStats.stdev > 18,
        titleText: '',
        titleConfidence: 0,
        primaryHeaderText: '',
        secondaryHeaderText: '',
        footerLabelText: '',
        footerLabelConfidence: 0
    };

    if (!options.ocr) {
        return insights;
    }

    const titleText = await recognizeText(title.buffer, undefined);
    const primaryHeaderText = await recognizeText(primaryHeader.buffer, undefined);
    const secondaryHeaderText = await recognizeText(secondaryHeader.buffer, undefined);
    const footerLabelText = await recognizeText(footerRight.buffer, undefined);

    insights.titleText = titleText.text;
    insights.titleConfidence = titleText.confidence;
    insights.primaryHeaderText = primaryHeaderText.text;
    insights.secondaryHeaderText = secondaryHeaderText.text;
    insights.footerLabelText = footerLabelText.text;
    insights.footerLabelConfidence = footerLabelText.confidence;

    if (options.ocrBody) {
        const primaryBody = await regionStats(imagePath, regions.primaryBody);
        const secondaryBody = await regionStats(imagePath, regions.secondaryBody);
        insights.primaryBodyText = (await recognizeText(primaryBody.buffer, undefined)).text;
        insights.secondaryBodyText = (await recognizeText(secondaryBody.buffer, undefined)).text;
    }

    return insights;
}

export function buildFooterMetadata(imageInsights) {
    const issues = [];
    const footer = {
        left: [],
        right: []
    };

    if (imageInsights.footerLeftHasContent) {
        footer.left.push({ type: 'icon', name: 'unknown-icon' });
        issues.push('footer icons auto-detected but not matched to a known icon');
    }

    if (imageInsights.footerRightHasContent) {
        if (imageInsights.footerLabelText && imageInsights.footerLabelConfidence >= 0.45) {
            footer.right.push({
                type: 'label',
                text: imageInsights.footerLabelText
            });
        } else {
            footer.right.push({ type: 'icon', name: 'unknown-icon' });
            issues.push('footer label region contains content but OCR confidence is low');
        }
    }

    return {
        footer,
        issues
    };
}

export function buildExtractionIssues(legacyCard, imageInsights, footerIssues) {
    const issues = [...footerIssues];

    if (!Array.isArray(legacyCard.sections) || legacyCard.sections.length === 0) {
        issues.push('legacy sections missing, rich record seeded without body text');
    }

    if (imageInsights.titleText && !titlesRoughlyMatch(legacyCard.card, imageInsights.titleText)) {
        issues.push('title OCR does not fully match the legacy card title');
    }

    if (imageInsights.primaryHeaderText && legacyCard.sections?.[0]?.header && !titlesRoughlyMatch(legacyCard.sections[0].header, imageInsights.primaryHeaderText)) {
        issues.push('primary section header OCR differs from seeded section heading');
    }

    if (legacyCard.sections?.some(section => String(section.text || '').includes('[unknown-icon]'))) {
        issues.push('inline icon placeholder requires manual review');
    }

    return [...new Set(issues)];
}

export function buildExtractionConfidence(legacyCard, imageInsights, issues) {
    let confidence = 0.18;

    if (legacyCard.card) {
        confidence += 0.14;
    }

    if (Array.isArray(legacyCard.sections) && legacyCard.sections.length > 0) {
        confidence += 0.32;
    }

    if (imageInsights.titleConfidence) {
        confidence += Math.min(0.16, imageInsights.titleConfidence * 0.16);
    }

    if (imageInsights.footerLabelConfidence) {
        confidence += Math.min(0.08, imageInsights.footerLabelConfidence * 0.08);
    }

    if (issues.length === 0) {
        confidence += 0.12;
    }

    return round(Math.max(0, Math.min(0.98, confidence)), 4);
}

export function buildRichRecord(legacyCard, gameName, imageInsights) {
    const { footer, issues: footerIssues } = buildFooterMetadata(imageInsights);
    const issues = buildExtractionIssues(legacyCard, imageInsights, footerIssues);
    const confidence = buildExtractionConfidence(legacyCard, imageInsights, issues);
    const status = issues.length === 0 ? 'auto' : 'needs-review';

    const candidate = {
        id: legacyCard.id,
        card: legacyCard.card,
        slug: slugifyCardText(legacyCard.card),
        type: legacyCard.type,
        game: gameName,
        sourceImage: legacyCard.contents,
        renderMode: 'rich',
        sections: (legacyCard.sections || []).map(section => ({
            kind: section.kind || 'mode',
            label: section.label || section.header || '',
            text: section.text || '',
            ...(Number.isFinite(section.threshold) ? { threshold: section.threshold } : {})
        })),
        footer,
        tags: [],
        tokens: {
            style: 'inline-bracket'
        },
        extraction: {
            status,
            confidence,
            issues,
            managedBy: 'extractor'
        }
    };

    return normalizeCard(candidate, gameName, 'rich');
}

async function loadExistingRichCards() {
    const manifestPath = path.join(cardsRoot, 'manifest.json');

    try {
        const manifest = await loadJson(manifestPath);
        const games = {};
        const byId = new Map();

        for (const [gameName, relativePath] of Object.entries(manifest.games || {})) {
            const payload = await loadJson(path.join(repoRoot, relativePath));
            const cards = Array.isArray(payload) ? payload : (payload.cards || []);
            games[gameName] = cards;
            cards.forEach(card => byId.set(card.id, card));
        }

        return { manifest, games, byId };
    } catch {
        return {
            manifest: null,
            games: {},
            byId: new Map()
        };
    }
}

export async function main() {
    const options = parseArgs(process.argv);
    const legacyCatalog = await loadJson(path.join(repoRoot, 'maladumcards.json'));
    const existingRich = await loadExistingRichCards();

    const richGames = {};
    const extractionReport = [];
    const imageInsightsCache = new Map();
    const gameEntries = Object.entries(legacyCatalog.games || {});
    let processedCount = 0;

    for (const [gameName, cards] of gameEntries) {
        if (options.gameFilter && gameName !== options.gameFilter) {
            continue;
        }

        richGames[gameName] = [];

        for (const legacyCard of cards) {
            if (Number.isFinite(options.limit) && processedCount >= options.limit) {
                break;
            }

            const existingCard = existingRich.byId.get(legacyCard.id);
            if (!options.force && existingCard && (existingCard.extraction?.managedBy === 'human' || existingCard.extraction?.status === 'verified')) {
                richGames[gameName].push(existingCard);
                extractionReport.push({
                    id: existingCard.id,
                    game: gameName,
                    card: existingCard.card,
                    sourceImage: existingCard.sourceImage,
                    status: existingCard.extraction?.status || 'verified',
                    confidence: existingCard.extraction?.confidence || 1,
                    issues: existingCard.extraction?.issues || [],
                    preserved: true
                });
                processedCount++;
                continue;
            }

            const imagePath = path.join(repoRoot, 'cardimages', legacyCard.contents);
            let imageInsights;

            if (imageInsightsCache.has(legacyCard.contents)) {
                imageInsights = imageInsightsCache.get(legacyCard.contents);
            } else {
                imageInsights = await inspectSourceImage(imagePath, options);
                imageInsightsCache.set(legacyCard.contents, imageInsights);
            }

            const richCard = buildRichRecord(legacyCard, gameName, imageInsights);
            const validationErrors = validateRichCardRecord(richCard, `${gameName}:${richCard.id}`);
            if (validationErrors.length > 0) {
                const details = validationErrors.map(error => `${error.path} ${error.message}`).join('\n');
                throw new Error(`Generated invalid rich card ${richCard.id}:\n${details}`);
            }

            richGames[gameName].push(richCard);
            extractionReport.push({
                id: richCard.id,
                game: gameName,
                card: richCard.card,
                sourceImage: richCard.sourceImage,
                status: richCard.extraction.status,
                confidence: richCard.extraction.confidence,
                issues: richCard.extraction.issues,
                footer: richCard.footer,
                regions: imageInsights.regions
            });

            processedCount++;
        }
    }

    const manifest = {
        sentryTypes: legacyCatalog.sentryTypes || [],
        corrupterTypes: legacyCatalog.corrupterTypes || [],
        heldBackCardTypes: legacyCatalog.heldBackCardTypes || [],
        games: Object.fromEntries(
            Object.keys(richGames).map(gameName => [gameName, `data/cards/${toGameFileName(gameName)}`])
        )
    };

    await writeJson(path.join(cardsRoot, 'manifest.json'), manifest);

    for (const [gameName, cards] of Object.entries(richGames)) {
        await writeJson(path.join(cardsRoot, toGameFileName(gameName)), {
            game: gameName,
            cards
        });
    }

    await writeJson(path.join(cardsRoot, 'extraction-report.json'), {
        generatedAt: new Date().toISOString(),
        processedCards: extractionReport.length,
        usedOcr: !!options.ocr,
        cards: extractionReport
    });

    await closeOcrWorker();
    console.log(`Generated structured card data for ${extractionReport.length} cards.`);
}

if (process.argv[1] === __filename) {
    main().catch(async error => {
        await closeOcrWorker();
        console.error(error);
        process.exitCode = 1;
    });
}
