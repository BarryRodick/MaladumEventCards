import { normalizeTokenSyntax, tokenizedTextToPlainText } from './card-tokenizer.mjs';

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

export function slugifyCardText(text = '') {
    return String(text)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function dedupeStrings(values) {
    return [...new Set(values.filter(Boolean).map(value => String(value).trim()).filter(Boolean))];
}

function normalizeSection(section = {}) {
    const label = typeof section.label === 'string' ? section.label.trim() : (typeof section.header === 'string' ? section.header.trim() : '');
    const kind = typeof section.kind === 'string' && section.kind.trim()
        ? section.kind.trim()
        : (label ? 'mode' : 'body');

    return {
        kind,
        label,
        text: normalizeTokenSyntax(section.text || ''),
        ...(Number.isFinite(section.threshold) ? { threshold: section.threshold } : {}),
        ...(typeof section.style === 'string' && section.style ? { style: section.style } : {})
    };
}

function normalizeFooterItems(items = []) {
    return toArray(items)
        .map(item => {
            if (!item || typeof item !== 'object') {
                return null;
            }

            if (item.type === 'label') {
                return {
                    type: 'label',
                    text: String(item.text || '').trim()
                };
            }

            return {
                type: 'icon',
                name: String(item.name || 'unknown-icon').trim().toLowerCase()
            };
        })
        .filter(item => item && ((item.type === 'label' && item.text) || (item.type === 'icon' && item.name)));
}

function normalizeExtraction(extraction, sourceKind, sourceImage) {
    if (extraction && typeof extraction === 'object' && !Array.isArray(extraction)) {
        return {
            status: extraction.status || 'needs-review',
            confidence: Number.isFinite(extraction.confidence) ? extraction.confidence : 0,
            issues: dedupeStrings(extraction.issues || []),
            managedBy: extraction.managedBy || 'extractor'
        };
    }

    if (sourceKind === 'legacy') {
        return {
            status: 'needs-review',
            confidence: 0,
            issues: [`Legacy image-backed fallback for ${sourceImage || 'unknown source image'}.`],
            managedBy: 'extractor'
        };
    }

    return {
        status: 'needs-review',
        confidence: 0,
        issues: ['Structured card requires manual review.'],
        managedBy: 'extractor'
    };
}

export function buildCardSearchText(card) {
    const sectionText = toArray(card.sections)
        .flatMap(section => [section.label || '', tokenizedTextToPlainText(section.text || '')])
        .join(' ');

    const footerText = ['left', 'right']
        .flatMap(side => toArray(card.footer?.[side]))
        .map(item => item.type === 'label' ? item.text : item.name)
        .join(' ');

    return [
        card.card,
        card.type,
        card.game,
        ...toArray(card.tags),
        sectionText,
        footerText
    ]
        .join(' ')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

export function normalizeCard(rawCard, gameName, sourceKind = 'legacy') {
    const sourceImage = rawCard?.sourceImage || rawCard?.contents || '';
    const footer = rawCard?.footer && typeof rawCard.footer === 'object' && !Array.isArray(rawCard.footer)
        ? {
            left: normalizeFooterItems(rawCard.footer.left),
            right: normalizeFooterItems(rawCard.footer.right)
        }
        : { left: [], right: [] };

    const normalized = {
        id: rawCard?.id,
        card: String(rawCard?.card || '').trim(),
        slug: String(rawCard?.slug || slugifyCardText(rawCard?.card || '')).trim(),
        type: String(rawCard?.type || '').trim(),
        game: String(gameName || rawCard?.game || '').trim(),
        sourceImage,
        contents: sourceImage,
        renderMode: sourceKind === 'rich' ? 'rich' : 'image',
        sections: toArray(rawCard?.sections).map(normalizeSection).filter(section => section.text || section.label),
        footer,
        tags: dedupeStrings(rawCard?.tags || []),
        tokens: {
            style: 'inline-bracket'
        },
        extraction: normalizeExtraction(rawCard?.extraction, sourceKind, sourceImage)
    };

    normalized.searchText = isNonEmptyString(rawCard?.searchText)
        ? String(rawCard.searchText).trim().toLowerCase()
        : buildCardSearchText(normalized);

    return normalized;
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function normalizeRichGameCards(gameName, richGamePayload) {
    const payloadCards = Array.isArray(richGamePayload)
        ? richGamePayload
        : toArray(richGamePayload?.cards);

    return payloadCards.map(card => normalizeCard(card, gameName, 'rich'));
}

function mergeCardsForGame(gameName, legacyCards = [], richCards = []) {
    const byId = new Map();

    legacyCards
        .map(card => normalizeCard(card, gameName, 'legacy'))
        .forEach(card => byId.set(card.id, card));

    richCards
        .map(card => normalizeCard(card, gameName, 'rich'))
        .forEach(card => byId.set(card.id, card));

    return [...byId.values()].sort((left, right) => left.id - right.id);
}

export function mergeCardCatalogs(legacyCatalog = {}, richCatalog = null) {
    const richManifest = richCatalog?.manifest || {};
    const manifestTypes = {
        sentryTypes: richManifest.sentryTypes || legacyCatalog.sentryTypes || [],
        corrupterTypes: richManifest.corrupterTypes || legacyCatalog.corrupterTypes || [],
        heldBackCardTypes: richManifest.heldBackCardTypes || legacyCatalog.heldBackCardTypes || []
    };

    const gameNames = new Set([
        ...Object.keys(legacyCatalog.games || {}),
        ...Object.keys(richCatalog?.games || {})
    ]);

    const games = {};
    gameNames.forEach(gameName => {
        games[gameName] = mergeCardsForGame(
            gameName,
            legacyCatalog.games?.[gameName] || [],
            normalizeRichGameCards(gameName, richCatalog?.games?.[gameName] || [])
        );
    });

    return {
        ...manifestTypes,
        games,
        icons: richCatalog?.icons || {},
        cardManifest: richManifest
    };
}

export function searchCards(cards = [], rawQuery = '') {
    const query = String(rawQuery || '').trim().toLowerCase();
    if (!query) {
        return [];
    }

    const queryTerms = query.split(/\s+/).filter(Boolean);

    return [...cards]
        .filter(card => queryTerms.every(term => String(card.searchText || '').includes(term)))
        .sort((left, right) => {
            const leftTitle = left.card.toLowerCase();
            const rightTitle = right.card.toLowerCase();
            const leftScore = leftTitle === query ? 0 : leftTitle.startsWith(query) ? 1 : leftTitle.includes(query) ? 2 : 3;
            const rightScore = rightTitle === query ? 0 : rightTitle.startsWith(query) ? 1 : rightTitle.includes(query) ? 2 : 3;

            if (leftScore !== rightScore) {
                return leftScore - rightScore;
            }

            return left.card.localeCompare(right.card);
        });
}
