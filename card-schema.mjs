const VALID_EXTRACTION_STATUSES = new Set(['auto', 'needs-review', 'verified']);
const VALID_SECTION_KINDS = new Set(['mode', 'body', 'box', 'flavor', 'note']);
const VALID_FOOTER_ITEM_TYPES = new Set(['icon', 'label']);

function pushError(errors, message, path) {
    errors.push({
        path,
        message
    });
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function validateSection(section, path, errors) {
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
        pushError(errors, 'Section must be an object.', path);
        return;
    }

    if (!isNonEmptyString(section.kind) || !VALID_SECTION_KINDS.has(section.kind)) {
        pushError(errors, `Section kind must be one of: ${Array.from(VALID_SECTION_KINDS).join(', ')}.`, `${path}.kind`);
    }

    if ('label' in section && typeof section.label !== 'string') {
        pushError(errors, 'Section label must be a string when provided.', `${path}.label`);
    }

    if (!isNonEmptyString(section.text)) {
        pushError(errors, 'Section text must be a non-empty string.', `${path}.text`);
    }

    if ('threshold' in section && !Number.isFinite(section.threshold)) {
        pushError(errors, 'Section threshold must be a finite number.', `${path}.threshold`);
    }
}

function validateFooterItem(item, path, errors) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
        pushError(errors, 'Footer item must be an object.', path);
        return;
    }

    if (!VALID_FOOTER_ITEM_TYPES.has(item.type)) {
        pushError(errors, 'Footer item type must be "icon" or "label".', `${path}.type`);
    }

    if (item.type === 'icon' && !isNonEmptyString(item.name)) {
        pushError(errors, 'Footer icon items must include a name.', `${path}.name`);
    }

    if (item.type === 'label' && !isNonEmptyString(item.text)) {
        pushError(errors, 'Footer label items must include text.', `${path}.text`);
    }
}

function validateExtraction(extraction, path, errors) {
    if (!extraction || typeof extraction !== 'object' || Array.isArray(extraction)) {
        pushError(errors, 'Extraction metadata must be an object.', path);
        return;
    }

    if (!VALID_EXTRACTION_STATUSES.has(extraction.status)) {
        pushError(errors, `Extraction status must be one of: ${Array.from(VALID_EXTRACTION_STATUSES).join(', ')}.`, `${path}.status`);
    }

    if ('confidence' in extraction && (!Number.isFinite(extraction.confidence) || extraction.confidence < 0 || extraction.confidence > 1)) {
        pushError(errors, 'Extraction confidence must be a number between 0 and 1.', `${path}.confidence`);
    }

    if ('issues' in extraction && (!Array.isArray(extraction.issues) || extraction.issues.some(issue => !isNonEmptyString(issue)))) {
        pushError(errors, 'Extraction issues must be an array of non-empty strings.', `${path}.issues`);
    }
}

export function validateRichCardRecord(card, path = 'card') {
    const errors = [];

    if (!card || typeof card !== 'object' || Array.isArray(card)) {
        pushError(errors, 'Card must be an object.', path);
        return errors;
    }

    if (!Number.isFinite(card.id)) {
        pushError(errors, 'Card id must be a finite number.', `${path}.id`);
    }

    ['card', 'slug', 'type', 'game', 'sourceImage', 'searchText'].forEach(field => {
        if (!isNonEmptyString(card[field])) {
            pushError(errors, `${field} must be a non-empty string.`, `${path}.${field}`);
        }
    });

    if ('renderMode' in card && card.renderMode !== 'rich') {
        pushError(errors, 'Rich card records must use renderMode "rich" when provided.', `${path}.renderMode`);
    }

    if (!Array.isArray(card.sections) || card.sections.length === 0) {
        pushError(errors, 'Card sections must be a non-empty array.', `${path}.sections`);
    } else {
        card.sections.forEach((section, index) => validateSection(section, `${path}.sections[${index}]`, errors));
    }

    if (!card.footer || typeof card.footer !== 'object' || Array.isArray(card.footer)) {
        pushError(errors, 'Card footer must be an object.', `${path}.footer`);
    } else {
        ['left', 'right'].forEach(side => {
            if (!Array.isArray(card.footer[side])) {
                pushError(errors, `Footer ${side} must be an array.`, `${path}.footer.${side}`);
                return;
            }

            card.footer[side].forEach((item, index) => validateFooterItem(item, `${path}.footer.${side}[${index}]`, errors));
        });
    }

    if ('tags' in card && (!Array.isArray(card.tags) || card.tags.some(tag => !isNonEmptyString(tag)))) {
        pushError(errors, 'Card tags must be an array of non-empty strings.', `${path}.tags`);
    }

    if ('tokens' in card && card.tokens?.style !== 'inline-bracket') {
        pushError(errors, 'Card tokens.style must be "inline-bracket" when provided.', `${path}.tokens.style`);
    }

    validateExtraction(card.extraction, `${path}.extraction`, errors);
    return errors;
}

export function validateIconManifest(iconManifest) {
    const errors = [];

    if (!iconManifest || typeof iconManifest !== 'object' || Array.isArray(iconManifest)) {
        pushError(errors, 'Icon manifest must be an object.', 'icons');
        return errors;
    }

    Object.entries(iconManifest).forEach(([name, entry]) => {
        const path = `icons.${name}`;
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            pushError(errors, 'Icon entries must be objects.', path);
            return;
        }

        if (!isNonEmptyString(entry.asset)) {
            pushError(errors, 'Icon asset must be a non-empty string.', `${path}.asset`);
        }

        if ('aliases' in entry && (!Array.isArray(entry.aliases) || entry.aliases.some(alias => !isNonEmptyString(alias)))) {
            pushError(errors, 'Icon aliases must be an array of non-empty strings.', `${path}.aliases`);
        }
    });

    return errors;
}

export function validateCardManifest(manifest) {
    const errors = [];

    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        pushError(errors, 'Card manifest must be an object.', 'manifest');
        return errors;
    }

    ['sentryTypes', 'corrupterTypes', 'heldBackCardTypes'].forEach(field => {
        if (!Array.isArray(manifest[field]) || manifest[field].some(value => !isNonEmptyString(value))) {
            pushError(errors, `${field} must be an array of non-empty strings.`, `manifest.${field}`);
        }
    });

    if (!manifest.games || typeof manifest.games !== 'object' || Array.isArray(manifest.games)) {
        pushError(errors, 'manifest.games must be an object map.', 'manifest.games');
    } else {
        Object.entries(manifest.games).forEach(([gameName, gamePath]) => {
            if (!isNonEmptyString(gameName)) {
                pushError(errors, 'Game names must be non-empty strings.', 'manifest.games');
            }
            if (!isNonEmptyString(gamePath)) {
                pushError(errors, 'Game paths must be non-empty strings.', `manifest.games.${gameName}`);
            }
        });
    }

    return errors;
}
