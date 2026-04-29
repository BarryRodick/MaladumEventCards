import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { normalizeCard } from '../card-data.mjs';
import { validateRichCardRecord } from '../card-schema.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const cardsRoot = path.join(repoRoot, 'data', 'cards');

const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const ALLOWED_FOOTER_ICONS = [
    'grave',
    'search',
    'arrow-up',
    'entry-point',
    'map',
    'wall',
    'larger-area',
    'creature',
    'camouflage',
    'malacytic-conduit',
    'otherworldly',
    'denizen',
    'mountain',
    'unknown-icon'
];

const RESPONSE_SCHEMA = {
    name: 'maladum_card_extraction',
    strict: true,
    schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
            sections: {
                type: 'array',
                description: 'Card sections in printed order. Preserve supplied text unless confidently correcting visible text or icon tokens.',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        kind: {
                            type: 'string',
                            enum: ['mode', 'body', 'box', 'flavor', 'note']
                        },
                        label: {
                            type: 'string'
                        },
                        text: {
                            type: 'string',
                            description: 'Use bracket tokens like [fire], [move:3], or [unknown-icon].'
                        },
                        threshold: {
                            type: ['number', 'null']
                        }
                    },
                    required: ['kind', 'label', 'text', 'threshold']
                }
            },
            footer: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    left: {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                type: {
                                    type: 'string',
                                    enum: ['icon', 'label']
                                },
                                name: {
                                    type: ['string', 'null'],
                                    enum: [...ALLOWED_FOOTER_ICONS, null]
                                },
                                text: {
                                    type: ['string', 'null']
                                }
                            },
                            required: ['type', 'name', 'text']
                        }
                    },
                    right: {
                        type: 'array',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                type: {
                                    type: 'string',
                                    enum: ['icon', 'label']
                                },
                                name: {
                                    type: ['string', 'null'],
                                    enum: [...ALLOWED_FOOTER_ICONS, null]
                                },
                                text: {
                                    type: ['string', 'null']
                                }
                            },
                            required: ['type', 'name', 'text']
                        }
                    }
                },
                required: ['left', 'right']
            },
            tags: {
                type: 'array',
                items: {
                    type: 'string'
                }
            },
            extraction: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    status: {
                        type: 'string',
                        enum: ['auto', 'needs-review', 'verified']
                    },
                    confidence: {
                        type: 'number'
                    },
                    issues: {
                        type: 'array',
                        items: {
                            type: 'string'
                        }
                    }
                },
                required: ['status', 'confidence', 'issues']
            }
        },
        required: ['sections', 'footer', 'tags', 'extraction']
    }
};

function parseArgs(argv) {
    const modelArg = argv.find(arg => arg.startsWith('--model='));
    const limitArg = argv.find(arg => arg.startsWith('--limit='));
    const gameArg = argv.find(arg => arg.startsWith('--game='));
    const idsArg = argv.find(arg => arg.startsWith('--ids='));
    const args = new Set(argv.slice(2));

    return {
        model: modelArg ? modelArg.split('=').slice(1).join('=').trim() : DEFAULT_MODEL,
        limit: limitArg ? Number.parseInt(limitArg.split('=')[1], 10) : null,
        game: gameArg ? gameArg.split('=').slice(1).join('=').trim() : null,
        ids: idsArg ? new Set(idsArg.split('=').slice(1).join('=').split(',').map(value => Number.parseInt(value, 10)).filter(Number.isFinite)) : null,
        dryRun: args.has('--dry-run'),
        force: args.has('--force')
    };
}

async function loadJson(filePath) {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildMimeType(imagePath) {
    const extension = path.extname(imagePath).toLowerCase();
    if (extension === '.jpg' || extension === '.jpeg') {
        return 'image/jpeg';
    }
    if (extension === '.webp') {
        return 'image/webp';
    }
    return 'image/png';
}

async function encodeImage(imagePath, options = {}) {
    const image = sharp(imagePath).rotate().normalize();

    if (options.extract) {
        image.extract(options.extract);
    }

    if (options.resize) {
        image.resize(options.resize.width, options.resize.height, {
            fit: 'inside',
            kernel: 'lanczos3'
        });
    }

    const jpeg = await image
        .sharpen()
        .jpeg({
            quality: 90,
            chromaSubsampling: '4:4:4'
        })
        .toBuffer();

    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

async function buildImagePayloads(card) {
    const imagePath = path.join(repoRoot, 'cardimages', card.sourceImage);
    const metadata = await sharp(imagePath).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    const footerLeft = {
        left: Math.round(width * 0.05),
        top: Math.round(height * 0.79),
        width: Math.round(width * 0.34),
        height: Math.round(height * 0.18)
    };
    const footerRight = {
        left: Math.round(width * 0.30),
        top: Math.round(height * 0.78),
        width: Math.round(width * 0.64),
        height: Math.round(height * 0.20)
    };

    return {
        full: await encodeImage(imagePath, {
            resize: { width: 1200, height: 1600 }
        }),
        footerLeft: await encodeImage(imagePath, {
            extract: footerLeft,
            resize: { width: 900, height: 420 }
        }),
        footerRight: await encodeImage(imagePath, {
            extract: footerRight,
            resize: { width: 1100, height: 460 }
        }),
        mimeType: buildMimeType(imagePath)
    };
}

function sanitizeFooterItems(items = []) {
    return items
        .map(item => {
            if (item.type === 'label') {
                return {
                    type: 'label',
                    text: String(item.text || '').trim()
                };
            }

            const name = ALLOWED_FOOTER_ICONS.includes(item.name) ? item.name : 'unknown-icon';
            return {
                type: 'icon',
                name
            };
        })
        .filter(item => (item.type === 'label' ? item.text : item.name));
}

function uniqueIssues(issues = []) {
    return Array.from(new Set(
        issues
            .map(issue => String(issue || '').trim())
            .filter(Boolean)
    ));
}

function countUnknownFooterIcons(footer) {
    return ['left', 'right']
        .flatMap(side => footer?.[side] || [])
        .filter(item => item?.type === 'icon' && item?.name === 'unknown-icon')
        .length;
}

function sectionsContainUnknownIcon(sections = []) {
    return sections.some(section => /\[unknown-icon(?:[:][^\]]+)?\]/i.test(String(section?.text || '')));
}

export function finalizeExtractionMetadata(previousCard, candidateCard, resultExtraction = {}) {
    const issues = uniqueIssues(Array.isArray(resultExtraction.issues) ? resultExtraction.issues : []);
    const unknownFooterIcons = countUnknownFooterIcons(candidateCard.footer);
    const hadPreviousFooterContent = ['left', 'right']
        .some(side => Array.isArray(previousCard.footer?.[side]) && previousCard.footer[side].length > 0);
    const hasCandidateFooterContent = ['left', 'right']
        .some(side => Array.isArray(candidateCard.footer?.[side]) && candidateCard.footer[side].length > 0);

    if (unknownFooterIcons > 0) {
        issues.push(
            unknownFooterIcons === 1
                ? 'footer still contains 1 unresolved icon'
                : `footer still contains ${unknownFooterIcons} unresolved icons`
        );
    }

    if (sectionsContainUnknownIcon(candidateCard.sections)) {
        issues.push('section text still contains [unknown-icon] placeholders');
    }

    if (hadPreviousFooterContent && !hasCandidateFooterContent) {
        issues.push('footer content was dropped during enrichment');
    }

    const confidence = Number.isFinite(resultExtraction.confidence)
        ? Math.max(0, Math.min(1, resultExtraction.confidence))
        : 0;

    return {
        status: issues.length > 0 ? 'needs-review' : 'auto',
        confidence,
        issues: uniqueIssues(issues),
        managedBy: 'extractor'
    };
}

async function callOpenRouter({ apiKey, model, card, icons, imagePayloads }) {
    const systemPrompt = [
        'You extract Maladum event card content from card images into strict JSON.',
        'Be conservative and never hallucinate unreadable text.',
        'Your primary task is to verify the footer icon clusters at the bottom of the card.',
        'Preserve the supplied sections unless the image clearly shows a correction.',
        'Inline icons inside section text must remain bracket tokens like [fire], [move:3], or [unknown-icon].',
        `Footer icons must use only these names: ${ALLOWED_FOOTER_ICONS.join(', ')}.`,
        'The left and right footer sides may legitimately be empty. Do not invent icons to make the footer feel balanced or symmetrical.',
        'If only one footer icon is visible, return only that icon. If a footer side contains no visible icon or label, return an empty array for that side.',
        'When unsure about footer icons or text, keep [unknown-icon] and add an extraction issue.'
    ].join(' ');

    const seed = {
        id: card.id,
        card: card.card,
        type: card.type,
        game: card.game,
        sourceImage: card.sourceImage,
        sections: card.sections,
        footer: card.footer,
        tags: card.tags,
        extraction: card.extraction
    };

    const userPrompt = [
        'Review this Maladum card image and improve the structured extraction.',
        'Keep id/card/type/game/sourceImage stable.',
        'Focus primarily on the footer icon clusters and footer labels.',
        'Treat the full-card image as context and the two footer crops as the main evidence for the bottom icons.',
        'Do not infer a missing icon from game logic or from the opposite footer side.',
        'Only adjust section text if the printed card clearly differs from the seeded text or an inline icon token is clearly wrong.',
        'Seed card JSON:',
        JSON.stringify(seed, null, 2),
        'Known footer icons:',
        JSON.stringify(ALLOWED_FOOTER_ICONS),
        'Known icon manifest:',
        JSON.stringify(icons, null, 2)
    ].join('\n\n');

    const response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            temperature: 0,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: userPrompt
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imagePayloads.full
                            }
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imagePayloads.footerLeft
                            }
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imagePayloads.footerRight
                            }
                        }
                    ]
                }
            ],
            response_format: {
                type: 'json_schema',
                json_schema: RESPONSE_SCHEMA
            }
        })
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenRouter request failed (${response.status}): ${body}`);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error(`OpenRouter returned no content for card ${card.id}.`);
    }

    return JSON.parse(content);
}

function mergeOpenRouterResult(card, result) {
    const candidate = normalizeCard({
        ...card,
        sections: (result.sections || []).map(section => ({
            kind: section.kind,
            label: section.label,
            text: section.text,
            ...(section.threshold !== null && section.threshold !== undefined ? { threshold: section.threshold } : {})
        })),
        footer: {
            left: sanitizeFooterItems(result.footer?.left || []),
            right: sanitizeFooterItems(result.footer?.right || [])
        },
        tags: Array.isArray(result.tags) ? result.tags : card.tags
    }, card.game, 'rich');

    const merged = {
        ...candidate,
        extraction: finalizeExtractionMetadata(card, candidate, result.extraction)
    };

    const validationErrors = validateRichCardRecord(merged, `${card.game}:${card.id}`);
    if (validationErrors.length > 0) {
        const details = validationErrors.map(error => `${error.path} ${error.message}`).join('\n');
        throw new Error(`Invalid enriched card ${card.id}:\n${details}`);
    }

    return merged;
}

function shouldProcessCard(card, options) {
    if (options.game && card.game !== options.game) {
        return false;
    }

    if (options.ids && !options.ids.has(card.id)) {
        return false;
    }

    if (!options.force && (card.extraction?.managedBy === 'human' || card.extraction?.status === 'verified')) {
        return false;
    }

    return card.extraction?.status === 'needs-review' || options.force;
}

export async function main() {
    const options = parseArgs(process.argv);
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is required.');
    }

    const manifest = await loadJson(path.join(cardsRoot, 'manifest.json'));
    const icons = await loadJson(path.join(cardsRoot, 'icons.json'));

    let processed = 0;
    let updated = 0;

    for (const relativePath of Object.values(manifest.games || {})) {
        const absolutePath = path.join(repoRoot, relativePath);
        const payload = await loadJson(absolutePath);
        const cards = Array.isArray(payload) ? payload : (payload.cards || []);
        let fileChanged = false;

        for (let index = 0; index < cards.length; index++) {
            if (Number.isFinite(options.limit) && processed >= options.limit) {
                break;
            }

            const card = cards[index];
            if (!shouldProcessCard(card, options)) {
                continue;
            }

            processed++;
            const imagePayloads = await buildImagePayloads(card);
            const result = await callOpenRouter({
                apiKey,
                model: options.model,
                card,
                icons,
                imagePayloads
            });
            const merged = mergeOpenRouterResult(card, result);
            cards[index] = merged;
            fileChanged = true;
            updated++;
            console.log(`Enriched ${merged.id} ${merged.card} (${merged.extraction.status}, ${(merged.extraction.confidence * 100).toFixed(0)}%)`);
        }

        if (fileChanged && !options.dryRun) {
            await writeJson(absolutePath, Array.isArray(payload) ? cards : { ...payload, cards });
        }
    }

    console.log(`OpenRouter enrichment processed ${processed} cards and updated ${updated}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
