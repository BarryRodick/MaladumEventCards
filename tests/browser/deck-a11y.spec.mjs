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
