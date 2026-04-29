const TOKEN_PATTERN = /\[[^[\]]+\]/g;
const LEGACY_ICON_PREFIX = /^icon:/i;

function getDocument(options = {}) {
    const doc = options.document || globalThis.document;
    if (!doc) {
        throw new Error('renderTokenizedText requires a document option outside the browser.');
    }
    return doc;
}

export function normalizeTokenName(name = '') {
    return String(name)
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, '-');
}

function humanizeTokenName(name = '') {
    return normalizeTokenName(name).replace(/-/g, ' ');
}

export function resolveIconEntry(iconRegistry = {}, tokenName = '') {
    if (!tokenName) {
        return null;
    }

    if (iconRegistry[tokenName]) {
        return iconRegistry[tokenName];
    }

    const normalized = normalizeTokenName(tokenName);
    if (iconRegistry[normalized]) {
        return iconRegistry[normalized];
    }

    for (const [name, entry] of Object.entries(iconRegistry)) {
        const aliases = Array.isArray(entry?.aliases) ? entry.aliases : [];
        if (normalizeTokenName(name) === normalized) {
            return entry;
        }
        if (aliases.some(alias => normalizeTokenName(alias) === normalized)) {
            return entry;
        }
    }

    return null;
}

export function normalizeTokenSyntax(text = '') {
    return String(text).replace(/\[(icon:[^[\]]+)\]/gi, (_, tokenBody) => {
        return `[${tokenBody.replace(LEGACY_ICON_PREFIX, '')}]`;
    });
}

export function parseInlineToken(rawToken = '') {
    const tokenBody = String(rawToken).trim().replace(/^\[/, '').replace(/\]$/, '');
    const normalizedBody = tokenBody.replace(LEGACY_ICON_PREFIX, '').trim();

    if (!normalizedBody) {
        return {
            kind: 'unknown',
            raw: rawToken,
            name: 'unknown-icon',
            value: null,
            canonical: '[unknown-icon]'
        };
    }

    const [namePart, ...valueParts] = normalizedBody.split(':');
    const name = normalizeTokenName(namePart);
    const value = valueParts.length > 0 ? valueParts.join(':').trim() : null;
    const canonical = `[${name}${value ? `:${value}` : ''}]`;

    return {
        kind: 'icon',
        raw: rawToken,
        name: name || 'unknown-icon',
        value,
        canonical
    };
}

export function tokenizeCardText(text = '') {
    const normalizedText = normalizeTokenSyntax(text);
    const parts = [];
    let lastIndex = 0;
    let match;

    TOKEN_PATTERN.lastIndex = 0;

    while ((match = TOKEN_PATTERN.exec(normalizedText)) !== null) {
        if (match.index > lastIndex) {
            parts.push({
                kind: 'text',
                text: normalizedText.slice(lastIndex, match.index)
            });
        }

        parts.push(parseInlineToken(match[0]));
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < normalizedText.length) {
        parts.push({
            kind: 'text',
            text: normalizedText.slice(lastIndex)
        });
    }

    return parts;
}

export function tokenizedTextToPlainText(text = '') {
    return tokenizeCardText(text)
        .map(part => {
            if (part.kind === 'text') {
                return part.text;
            }

            return part.value ? `${part.name} ${part.value}` : part.name;
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function appendUnknownToken(doc, fragment, token) {
    const unknown = doc.createElement('span');
    unknown.className = 'card-inline-token card-inline-token--unknown';
    unknown.textContent = token.raw || token.canonical || '[unknown-icon]';
    fragment.appendChild(unknown);
}

export function renderTokenizedText(text = '', options = {}) {
    const doc = getDocument(options);
    const fragment = doc.createDocumentFragment();
    const iconRegistry = options.iconRegistry || {};
    const baseIconPath = options.baseIconPath || '';

    tokenizeCardText(text).forEach(part => {
        if (part.kind === 'text') {
            fragment.appendChild(doc.createTextNode(part.text));
            return;
        }

        const iconEntry = resolveIconEntry(iconRegistry, part.name);
        if (!iconEntry?.asset) {
            appendUnknownToken(doc, fragment, part);
            return;
        }

        const tokenNode = doc.createElement('span');
        const tokenKind = iconEntry.kind || 'inline';
        tokenNode.className = `card-inline-token card-inline-token--${tokenKind}`;
        tokenNode.dataset.tokenName = part.name;
        tokenNode.dataset.tokenKind = tokenKind;
        tokenNode.setAttribute('role', 'img');
        tokenNode.setAttribute(
            'aria-label',
            part.value ? `${humanizeTokenName(part.name)} ${part.value}` : humanizeTokenName(part.name)
        );

        const icon = doc.createElement('img');
        icon.className = 'card-inline-token__icon';
        icon.src = `${baseIconPath}${iconEntry.asset}`;
        icon.alt = '';
        icon.setAttribute('aria-hidden', 'true');
        tokenNode.appendChild(icon);

        if (part.value) {
            const value = doc.createElement('span');
            value.className = 'card-inline-token__value';
            value.textContent = part.value;
            tokenNode.appendChild(value);
        }

        fragment.appendChild(tokenNode);
    });

    return fragment;
}
