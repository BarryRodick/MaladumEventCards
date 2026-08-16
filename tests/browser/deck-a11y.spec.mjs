import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createStaticServer } from '../../scripts/serve-static.mjs';

let staticServer;

test.beforeAll(async () => {
    staticServer = createStaticServer();
    await new Promise((resolve, reject) => {
        staticServer.once('error', reject);
        staticServer.listen(4173, '127.0.0.1', resolve);
    });
});

test.afterAll(async () => {
    if (!staticServer) return;
    await new Promise(resolve => {
        staticServer.close(resolve);
        staticServer.closeAllConnections();
    });
});

async function expectAccessibleDeck(page, stateName) {
    const results = await new AxeBuilder({ page })
        .include('#deckExperience')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

    expect(results.violations, `${stateName} axe violations:\n${JSON.stringify(
        results.violations.map(({ id, impact, help, nodes }) => ({
            id,
            impact,
            help,
            targets: nodes.map(node => node.target)
        })),
        null,
        2
    )}`).toEqual([]);
}

async function selectOnlyBaseGame(page) {
    const checkboxes = page.locator('#gameCheckboxes input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible();

    for (let index = 0; index < await checkboxes.count(); index++) {
        const checkbox = checkboxes.nth(index);
        if (await checkbox.getAttribute('value') !== 'Base Game' && await checkbox.isChecked()) {
            await checkbox.uncheck();
        }
    }

    await expect(page.locator('#game-base-game')).toBeChecked();
}

function isCatalogRequest(requestUrl) {
    const pathname = new URL(requestUrl).pathname;
    return pathname.endsWith('/maladumcards.json')
        || pathname.endsWith('/difficulties.json')
        || pathname.includes('/data/cards/');
}

function failBaseGameRequest(route) {
    return new URL(route.request().url()).pathname.endsWith('/data/cards/base-game.json')
        ? route.abort()
        : route.continue();
}

test('clean offline startup stays blocked until Retry performs a successful reacquisition', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    let legacyAttempts = 0;
    page.on('request', request => {
        if (new URL(request.url()).pathname.endsWith('/maladumcards.json')) legacyAttempts++;
    });
    const failCatalog = route => {
        return isCatalogRequest(route.request().url()) ? route.abort() : route.continue();
    };
    await page.route('**/*', failCatalog);

    await page.goto('/');

    const status = page.locator('#catalogStatus');
    const retry = page.getByRole('button', { name: 'Retry Card Catalog' });
    await expect(status).toHaveAttribute('data-state', 'error');
    await expect(status).toContainText('Check your connection');
    await expect(retry).toBeVisible();
    await expect(page.locator('#deckExperience')).toBeHidden();

    await retry.click();
    await expect.poll(() => legacyAttempts).toBeGreaterThanOrEqual(2);
    await expect(status).toHaveAttribute('data-state', 'error');

    await page.unroute('**/*', failCatalog);
    await retry.click();

    await expect.poll(() => legacyAttempts).toBeGreaterThanOrEqual(3);
    await expect(status).toBeHidden();
    await expect(page.locator('#deckExperience')).toBeVisible();
    await expect(page.locator('#gameCheckboxes input[type="checkbox"]').first()).toBeVisible();
    const recoveredSnapshot = await page.evaluate(() => {
        const raw = localStorage.getItem('cachedCardCatalogSnapshot.v1');
        return raw ? JSON.parse(raw) : null;
    });
    expect(recoveredSnapshot?.version).toBe(1);
    expect(Object.values(recoveredSnapshot.catalog.games).flat()).toHaveLength(142);
});

test('cached offline startup keeps the last-known-good snapshot intact', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#deckExperience')).toBeVisible();

    const snapshotBefore = await page.evaluate(() => localStorage.getItem('cachedCardCatalogSnapshot.v1'));
    expect(snapshotBefore).toBeTruthy();

    const failCatalog = route => isCatalogRequest(route.request().url()) ? route.abort() : route.continue();
    await page.route('**/*', failCatalog);
    await page.reload();

    await expect(page.locator('#catalogStatus')).toHaveAttribute('data-state', 'offline');
    await expect(page.locator('#catalogStatus')).toContainText('last-known-good');
    await expect(page.getByRole('button', { name: 'Retry Card Catalog' })).toBeVisible();
    await expect(page.locator('#deckExperience')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('cachedCardCatalogSnapshot.v1'))).toBe(snapshotBefore);
});

test('one failed rich game cannot downgrade the richer atomic snapshot', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#deckExperience')).toBeVisible();

    const snapshotBefore = await page.evaluate(() => localStorage.getItem('cachedCardCatalogSnapshot.v1'));
    await page.route('**/*', failBaseGameRequest);
    await page.reload();

    await expect(page.locator('#catalogStatus')).toHaveAttribute('data-state', 'offline');
    await expect(page.locator('#deckExperience')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('cachedCardCatalogSnapshot.v1'))).toBe(snapshotBefore);
});

test('viable partial Card Catalog is session-only when no saved snapshot exists', async ({ page }) => {
    await page.route('**/*', failBaseGameRequest);
    await page.goto('/');

    await expect(page.locator('#catalogStatus')).toHaveAttribute('data-state', 'partial');
    await expect(page.locator('#catalogStatus')).toContainText('safe session data');
    await expect(page.getByRole('button', { name: 'Retry Card Catalog' })).toBeVisible();
    await expect(page.locator('#deckExperience')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('cachedCardCatalogSnapshot.v1'))).toBeNull();
});

test('Retry bypasses a malformed service-worker response and saves the recovered Card Catalog', async ({ browser }) => {
    const context = await browser.newContext({
        baseURL: 'http://127.0.0.1:4173',
        serviceWorkers: 'allow'
    });
    const page = await context.newPage();

    try {
        await page.goto('/');
        await expect(page.locator('#deckExperience')).toBeVisible();
        await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
        await page.reload();
        await expect(page.locator('#deckExperience')).toBeVisible();

        await page.evaluate(async () => {
            localStorage.removeItem('cachedCardCatalogSnapshot.v1');
            const cacheName = (await caches.keys())
                .find(name => name.startsWith('maladum-event-cards-'));
            if (!cacheName) throw new Error('App service-worker cache was not created');
            const cache = await caches.open(cacheName);
            const sourceUrl = new URL('data/cards/base-game.json', window.location.href);
            await cache.put(sourceUrl, new Response(JSON.stringify({ cards: [] }), {
                headers: { 'Content-Type': 'application/json' }
            }));
        });
        await page.reload();

        const status = page.locator('#catalogStatus');
        await expect(status).toHaveAttribute('data-state', 'partial');
        await expect(page.locator('#deckExperience')).toBeVisible();
        expect(await page.evaluate(() => localStorage.getItem('cachedCardCatalogSnapshot.v1'))).toBeNull();

        await page.getByRole('button', { name: 'Retry Card Catalog' }).click();

        await expect(status).toBeHidden();
        const recoveredSnapshot = await page.evaluate(() => {
            const raw = localStorage.getItem('cachedCardCatalogSnapshot.v1');
            return raw ? JSON.parse(raw) : null;
        });
        expect(Object.values(recoveredSnapshot.catalog.games).flat()).toHaveLength(142);
    } finally {
        await page.evaluate(async () => {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(registration => registration.unregister()));
            await Promise.all((await caches.keys()).map(name => caches.delete(name)));
        }).catch(() => { });
        await context.close();
    }
});

test('deck validation and core controls work by keyboard and pass focused axe checks', async ({ page }) => {
    await page.route('https://www.googletagmanager.com/**', route => route.abort());
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/');

    const buildMode = page.getByRole('button', { name: 'Build', exact: true });
    const playMode = page.getByRole('button', { name: 'Play', exact: true });
    const generate = page.locator('#generateDeck');

    await expect(page.locator('.input-count').first()).toBeVisible();
    await expect(page.locator('#deckExperience')).toHaveAttribute('data-mode', 'build');
    await expect(buildMode).toHaveAttribute('aria-pressed', 'true');
    await expect(playMode).toBeDisabled();
    await expect(page.locator('#deckModeGate')).toHaveText('Generate a deck to enable Play.');
    await expect(generate).toBeDisabled();

    await selectOnlyBaseGame(page);
    const countInputs = page.locator('.input-count');
    for (let index = 0; index < await countInputs.count(); index++) {
        await countInputs.nth(index).fill('0');
    }

    const noviceCount = page.locator('#type-novice');
    const noviceError = page.locator('#type-novice-error');
    const noviceMaximum = Number(await noviceCount.getAttribute('max'));
    await noviceCount.fill(String(noviceMaximum + 1));
    await expect(noviceCount).toHaveAttribute('aria-invalid', 'true');
    await expect(generate).toBeDisabled();

    await page.locator('#difficultyLevel').selectOption('1');
    await expect(noviceCount).toHaveValue('5');
    await expect(noviceCount).toHaveAttribute('aria-invalid', 'false');
    await expect(noviceError).toBeHidden();
    await expect(generate).toBeEnabled();
    await expect(generate).toContainText('Generate Deck');
    await noviceCount.fill('0');

    const environmentCount = page.locator('#type-environment');
    const environmentError = page.locator('#type-environment-error');
    const maximum = Number(await environmentCount.getAttribute('max'));
    expect(maximum).toBeGreaterThan(0);

    for (const invalidValue of ['', '1.5', '1e2', '-1']) {
        await environmentCount.fill(invalidValue);
        await expect(environmentCount).toHaveAttribute('aria-invalid', 'true');
        await expect(environmentError).toContainText(`Enter a whole number from 0 to ${maximum}.`);
        await expect(generate).toBeDisabled();
    }

    await environmentCount.fill(String(maximum + 1));
    await expect(environmentError).toHaveText(
        `Requested ${maximum + 1}; ${maximum} available. Enter a whole number from 0 to ${maximum}.`
    );
    await expect(generate).toBeDisabled();

    await environmentCount.fill('0');
    await expect(environmentCount).toHaveAttribute('aria-invalid', 'false');
    await expect(environmentError).toBeHidden();
    await expect(generate).toBeDisabled();
    await expect(generate).toContainText('Choose Card Counts');

    await environmentCount.fill(String(maximum));
    await expect(environmentCount).toHaveAttribute('aria-invalid', 'false');
    await expect(generate).toBeEnabled();
    await expect(generate).toContainText('Generate Deck');
    await expectAccessibleDeck(page, 'Prepare Deck');

    await generate.focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('#deckExperience')).toHaveAttribute('data-mode', 'play');
    await expect(playMode).toHaveAttribute('aria-pressed', 'true');
    await expect(playMode).toBeEnabled();
    await expect(page.locator('#deckSummaryRemaining .summary-chip-value')).toHaveText(String(maximum));
    await expect(page.locator('#progressText')).toHaveText('Ready to draw');

    await buildMode.focus();
    await page.keyboard.press('Space');
    await expect(buildMode).toHaveAttribute('aria-pressed', 'true');
    await expect(playMode).toHaveAttribute('aria-pressed', 'false');

    await playMode.focus();
    await page.keyboard.press('Enter');
    await expect(playMode).toHaveAttribute('aria-pressed', 'true');
    await expect(buildMode).toHaveAttribute('aria-pressed', 'false');

    const previous = page.getByRole('button', { name: 'Previous' });
    const markInPlay = page.getByRole('button', { name: 'Mark In Play' });
    const drawNext = page.getByRole('button', { name: 'Draw Next Card' });
    const navigationGate = page.locator('#deckNavigationGate');

    await expect(previous).toBeDisabled();
    await expect(markInPlay).toBeDisabled();
    await expect(navigationGate).toContainText('Draw a card');

    await drawNext.click();
    await expect(previous).toBeDisabled();
    await expect(markInPlay).toBeEnabled();
    await expect(navigationGate).toContainText('second card');

    await markInPlay.click();
    await expect(markInPlay).toBeDisabled();
    await expect(navigationGate).toContainText('already in play');

    await drawNext.click();
    await expect(previous).toBeEnabled();
    await expect(markInPlay).toBeEnabled();
    await expect(navigationGate).toBeHidden();

    await previous.click();
    await expect(previous).toBeDisabled();
    await expect(markInPlay).toBeDisabled();
    await expect(navigationGate).toContainText('already in play');

    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const search = page.getByRole('searchbox', { name: 'Search cards' });
    await expect(search).toBeFocused();
    await search.fill('definitely-no-matching-card');
    await expect(page.locator('#cardSearchStatus')).toHaveText('No matching cards found.');
    await expect(page.locator('#cardSearchContent [role="status"]')).toHaveCount(1);

    await search.fill('Alarm');
    await expect(page.locator('#cardSearchStatus')).toHaveText(/Showing \d+ of \d+ matching cards\./);

    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    const shuffleTop = page.getByRole('button', { name: 'Shuffle Top N', exact: true });
    const insertCard = page.getByRole('button', { name: 'Insert Card', exact: true });
    await expect(shuffleTop).toBeVisible();
    await expect(insertCard).toBeVisible();

    await shuffleTop.click();
    await expect(page.getByRole('spinbutton', { name: /Shuffle into top/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Decrease shuffle count' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Increase shuffle count' })).toBeVisible();

    await insertCard.click();
    await expect(page.getByRole('combobox', { name: 'Card Type' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Specific Card (Optional)' })).toBeVisible();

    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    await expectAccessibleDeck(page, 'Run Deck');
});
