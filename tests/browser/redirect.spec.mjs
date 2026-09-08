import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createStaticServer } from '../../scripts/serve-static.mjs';

const destination = 'https://eventdeck.barryrodick.chatgpt.site/';
const baseline = '13f2a554f4416abbad736f81225e1aab4a710d84';
let server, url, overrides = {};
test.beforeAll(async () => {
    server = createStaticServer();
    const original = server.listeners('request')[0]; server.removeAllListeners('request');
    server.on('request', (req, res) => {
        const path = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
        if (Object.hasOwn(overrides, path)) {
            res.writeHead(200, { 'Content-Type': path.endsWith('.js') ? 'application/javascript' : path.endsWith('.json') ? 'application/json' : 'text/html', 'Cache-Control': 'no-store' });
            res.end(overrides[path]);
        } else original(req, res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
test.beforeEach(async ({ context }) => {
    overrides = {};
    await context.route(destination, route => route.fulfill({ contentType: 'text/html', body: '<h1>Eventdeck destination</h1>' }));
});

test('homepage variants redirect to the fixed destination without carrying old parameters', async ({ page }) => {
    for (const path of ['/', '/?', '/index.html', '/?campaign=old#deck', '/?legacy=0']) {
        await page.goto(url + path);
        await expect(page).toHaveURL(destination);
        await expect(page.getByRole('heading', { name: 'Eventdeck destination' })).toBeVisible();
    }
});

test('legacy escape hatch opens the existing deck builder', async ({ page }) => {
    await page.goto(url + '/?legacy=1');
    await expect(page.locator('#gameCheckboxes input').first()).toBeVisible();
    await expect(page).toHaveURL(url + '/?legacy=1');
});

test('no-JavaScript visitor also receives the redirect', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.route(destination, route => route.fulfill({ contentType: 'text/html', body: '<h1>Eventdeck destination</h1>' }));
    const page = await context.newPage();
    try { await page.goto(url + '/?'); await expect(page).toHaveURL(destination); }
    finally { await context.close(); }
});

test.describe('returning cached visitors', () => {
    test.use({ serviceWorkers: 'allow' });
    test('forward worker update redirects homepage and preserves origin storage', async ({ page: initial, context }) => {
        test.setTimeout(60000);
        let page = initial;
        for (const file of ['index.html', 'service-worker.js', 'version.json']) {
            overrides[file] = execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' });
        }
        await page.goto(url + '/');
        await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
        await page.evaluate(() => {
            localStorage.setItem('redirect-test-deck', '{"cards":[1,2,3],"position":1}');
            localStorage.setItem('redirect-test-campaign', '{"quest":"retained"}');
        });
        const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
        overrides = {};
        await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
        await page.close(); page = await context.newPage();
        await page.goto(url + '/?legacy=1');
        await expect.poll(() => page.evaluate(async () => {
            await navigator.serviceWorker.ready;
            return new Promise(resolve => {
                const channel = new MessageChannel(); channel.port1.onmessage = event => resolve(event.data);
                navigator.serviceWorker.controller.postMessage('GET_VERSION', [channel.port2]);
            });
        })).toBe('2.16.3');
        expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(before);
        await page.goto(url + '/?'); await expect(page).toHaveURL(destination);
        await page.goto(url + '/index.html?legacy=1');
        await expect(page.locator('#gameCheckboxes input').first()).toBeVisible();
        expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(before);
        // Roll back with a newer worker version, never by serving an older cache version.
        for (const file of ['index.html', 'service-worker.js', 'version.json']) {
            overrides[file] = execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' }).replaceAll('2.16.2', '2.16.4');
        }
        await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
        await page.close(); page = await context.newPage();
        await page.goto(url + '/?legacy=1');
        await expect.poll(() => page.evaluate(async () => new Promise(resolve => {
            const channel = new MessageChannel(); channel.port1.onmessage = event => resolve(event.data);
            navigator.serviceWorker.controller.postMessage('GET_VERSION', [channel.port2]);
        }))).toBe('2.16.4');
        await page.goto(url + '/');
        await expect(page.locator('#gameCheckboxes input').first()).toBeVisible();
        expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(before);
    });
});
