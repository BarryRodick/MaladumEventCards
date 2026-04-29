import { renderTokenizedText } from './card-tokenizer.mjs';

function getDocument(options = {}) {
    const doc = options.document || globalThis.document;
    if (!doc) {
        throw new Error('card-renderer requires a document option outside the browser.');
    }
    return doc;
}

function clearChildren(node) {
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}

function appendSectionParagraphs(doc, sectionBody, section, options) {
    const paragraphs = String(section.text || '')
        .split(/\n{2,}/)
        .map(paragraph => paragraph.trim())
        .filter(Boolean);

    paragraphs.forEach(paragraph => {
        const paragraphNode = doc.createElement('p');
        paragraphNode.className = 'card-section__text';
        paragraphNode.appendChild(renderTokenizedText(paragraph, options));
        sectionBody.appendChild(paragraphNode);
    });
}

function createMetaRow(doc, card) {
    const meta = doc.createElement('div');
    meta.className = 'card-surface__meta';

    const type = doc.createElement('span');
    type.className = 'card-meta-pill';
    type.textContent = card.type;
    meta.appendChild(type);

    const game = doc.createElement('span');
    game.className = 'card-meta-pill card-meta-pill--muted';
    game.textContent = card.game;
    meta.appendChild(game);

    return meta;
}

function createFooter(doc, card, options, { compact = false } = {}) {
    if (!card.footer || (!card.footer.left?.length && !card.footer.right?.length)) {
        return null;
    }

    const footer = doc.createElement('div');
    footer.className = 'card-surface__footer';
    let hasVisibleItems = false;

    ['left', 'right'].forEach(side => {
        const items = (card.footer[side] || []).filter(item => item && (!compact || item.type === 'icon'));
        if (items.length === 0) {
            return;
        }

        const sideNode = doc.createElement('div');
        sideNode.className = `card-footer-side card-footer-side--${side}`;

        items.forEach(item => {
            if (item.type === 'label') {
                const label = doc.createElement('span');
                label.className = 'card-footer-label';
                label.textContent = item.text;
                sideNode.appendChild(label);
                return;
            }

            const placeholder = renderTokenizedText(`[${item.name}]`, options);
            const wrapper = doc.createElement('span');
            wrapper.className = 'card-footer-icon';
            wrapper.appendChild(placeholder);
            sideNode.appendChild(wrapper);
        });

        if (sideNode.children.length > 0) {
            footer.appendChild(sideNode);
            hasVisibleItems = true;
        }
    });

    return hasVisibleItems ? footer : null;
}

function renderRichCard(doc, card, options = {}, size = 'full') {
    const article = doc.createElement('article');
    article.className = `card-surface card-surface--rich card-surface--${size}`;
    article.dataset.cardSurface = 'true';
    article.dataset.cardId = String(card.id);

    const title = doc.createElement('h3');
    title.className = 'card-surface__title';
    title.textContent = card.card;
    article.appendChild(title);

    if (size !== 'compact') {
        article.appendChild(createMetaRow(doc, card));

        const sections = doc.createElement('div');
        sections.className = 'card-surface__sections';

        card.sections.forEach(section => {
            const sectionNode = doc.createElement('section');
            sectionNode.className = `card-section card-section--${section.kind || 'body'}`;

            if (section.label) {
                const header = doc.createElement('div');
                header.className = 'card-section__header';

                const label = doc.createElement('h4');
                label.className = 'card-section__label';
                label.textContent = section.label;
                header.appendChild(label);

                if (Number.isFinite(section.threshold)) {
                    const threshold = doc.createElement('span');
                    threshold.className = 'card-section__threshold';
                    threshold.textContent = String(section.threshold);
                    header.appendChild(threshold);
                }

                sectionNode.appendChild(header);
            }

            const body = doc.createElement('div');
            body.className = 'card-section__body';
            appendSectionParagraphs(doc, body, section, options);
            sectionNode.appendChild(body);
            sections.appendChild(sectionNode);
        });

        article.appendChild(sections);
    }

    const footer = createFooter(doc, card, options, { compact: size === 'compact' });
    if (footer) {
        article.appendChild(footer);
    }

    if (size !== 'compact' && options.showExtraction && card.extraction) {
        const extraction = doc.createElement('div');
        extraction.className = `card-extraction card-extraction--${card.extraction.status}`;
        extraction.textContent = `${card.extraction.status} • ${(card.extraction.confidence * 100).toFixed(0)}%`;
        article.appendChild(extraction);
    }

    return article;
}

function renderImageCard(doc, card, size = 'full') {
    const figure = doc.createElement('figure');
    figure.className = `card-surface card-surface--image card-surface--${size}`;
    figure.dataset.cardSurface = 'true';
    figure.dataset.cardId = String(card.id);

    const image = doc.createElement('img');
    image.className = 'card-image-fallback';
    image.src = `cardimages/${card.sourceImage}`;
    image.alt = card.card;
    figure.appendChild(image);

    if (size !== 'compact') {
        const caption = doc.createElement('figcaption');
        caption.className = 'visually-hidden';
        caption.textContent = `${card.card} (${card.type})`;
        figure.appendChild(caption);
    }

    return figure;
}

export function renderCardNode(card, options = {}) {
    const doc = getDocument(options);
    if (!card) {
        const placeholder = doc.createElement('div');
        placeholder.className = 'card-surface card-surface--placeholder';
        placeholder.textContent = 'Card unavailable';
        return placeholder;
    }

    return card.renderMode === 'rich'
        ? renderRichCard(doc, card, options, 'full')
        : renderImageCard(doc, card, 'full');
}

export function renderCompactCardNode(card, options = {}) {
    const doc = getDocument(options);
    if (!card) {
        return renderCardNode(card, options);
    }

    return card.renderMode === 'rich'
        ? renderRichCard(doc, card, options, 'compact')
        : renderImageCard(doc, card, 'compact');
}

export function renderCardInto(container, card, options = {}) {
    clearChildren(container);
    container.appendChild(renderCardNode(card, options));
    return container;
}
