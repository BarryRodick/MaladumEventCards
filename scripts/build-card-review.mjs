import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const cardsRoot = path.join(repoRoot, 'data', 'cards');
const reviewRoot = path.join(repoRoot, 'reports', 'card-review');

async function loadJson(filePath) {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function main() {
    const manifest = await loadJson(path.join(cardsRoot, 'manifest.json'));
    const icons = await loadJson(path.join(cardsRoot, 'icons.json'));
    const previousReport = await loadJson(path.join(cardsRoot, 'extraction-report.json'));

    const cards = [];
    for (const relativePath of Object.values(manifest.games || {})) {
        const payload = await loadJson(path.join(repoRoot, relativePath));
        cards.push(...(Array.isArray(payload) ? payload : (payload.cards || [])));
    }

    const previousReportById = new Map((previousReport.cards || []).map(card => [card.id, card]));
    const refreshedReportCards = cards.map(card => {
        const previous = previousReportById.get(card.id) || {};
        return {
            id: card.id,
            game: card.game,
            card: card.card,
            sourceImage: card.sourceImage,
            status: card.extraction?.status || 'needs-review',
            confidence: card.extraction?.confidence || 0,
            issues: card.extraction?.issues || [],
            footer: card.footer,
            regions: previous.regions || null
        };
    });
    const reportById = new Map(refreshedReportCards.map(card => [card.id, card]));
    const sortedCards = [...cards].sort((left, right) => {
        const statusRank = value => value === 'needs-review' ? 0 : value === 'auto' ? 1 : 2;
        const rankDiff = statusRank(left.extraction?.status) - statusRank(right.extraction?.status);
        if (rankDiff !== 0) {
            return rankDiff;
        }
        return left.card.localeCompare(right.card);
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maladum Card Review</title>
  <link rel="stylesheet" href="../../styles.css">
  <style>
    body { background: #101010; color: #f5e9cf; margin: 0; font-family: system-ui, sans-serif; }
    .review-shell { max-width: 1480px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
    .review-grid { display: grid; gap: 1rem; }
    .review-row { display: grid; grid-template-columns: minmax(280px, 320px) minmax(280px, 420px) 1fr; gap: 1rem; align-items: start; padding: 1rem; background: rgba(255,255,255,0.04); border-radius: 18px; border: 1px solid rgba(255,255,255,0.08); }
    .review-image img { width: 100%; border-radius: 14px; box-shadow: 0 12px 28px rgba(0,0,0,0.42); }
    .review-meta { display: grid; gap: 0.75rem; }
    .review-pre { margin: 0; white-space: pre-wrap; background: rgba(0,0,0,0.32); padding: 0.85rem; border-radius: 12px; color: #f2ebdd; }
    .review-badge { display: inline-flex; align-items: center; gap: 0.35rem; border-radius: 999px; padding: 0.3rem 0.7rem; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04rem; }
    .review-badge.needs-review { background: rgba(138, 92, 20, 0.18); color: #f2cf8f; }
    .review-badge.auto { background: rgba(40, 116, 72, 0.18); color: #90d3aa; }
    .review-badge.verified { background: rgba(39, 89, 158, 0.18); color: #9ec4ff; }
    @media (max-width: 1180px) { .review-row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="review-shell">
    <h1>Maladum Card Review</h1>
    <p>Source image, structured render, and extraction details are shown side by side. Cards marked <strong>needs-review</strong> should be corrected before verification.</p>
    <div id="reviewGrid" class="review-grid"></div>
  </div>
  <script type="module">
    import { renderCardNode } from '../../card-renderer.mjs';

    const cards = ${JSON.stringify(sortedCards)};
    const icons = ${JSON.stringify(icons)};
    const reportById = new Map(${JSON.stringify([...reportById.entries()])});
    const grid = document.getElementById('reviewGrid');

    cards.forEach(card => {
      const row = document.createElement('article');
      row.className = 'review-row';

      const left = document.createElement('div');
      left.className = 'review-image';
      const image = document.createElement('img');
      image.src = '../../cardimages/' + card.sourceImage;
      image.alt = card.card;
      left.appendChild(image);

      const middle = document.createElement('div');
      middle.appendChild(renderCardNode(card, { document, iconRegistry: icons, baseIconPath: '../../' }));

      const right = document.createElement('div');
      right.className = 'review-meta';

      const title = document.createElement('div');
      title.innerHTML = '<h2 style="margin:0 0 0.35rem">' + card.card + '</h2><div class="review-badge ' + card.extraction.status + '">' + card.extraction.status + ' • ' + Math.round(card.extraction.confidence * 100) + '%</div>';
      right.appendChild(title);

      const details = document.createElement('pre');
      details.className = 'review-pre';
      const reportEntry = reportById.get(card.id) || {};
      details.textContent = JSON.stringify({
        id: card.id,
        game: card.game,
        type: card.type,
        sourceImage: card.sourceImage,
        sections: card.sections,
        footer: card.footer,
        extraction: card.extraction,
        report: reportEntry
      }, null, 2);
      right.appendChild(details);

      row.append(left, middle, right);
      grid.appendChild(row);
    });
  </script>
</body>
</html>`;

    await fs.mkdir(reviewRoot, { recursive: true });
    await fs.writeFile(path.join(cardsRoot, 'extraction-report.json'), `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        processedCards: refreshedReportCards.length,
        usedOcr: previousReport.usedOcr ?? false,
        cards: refreshedReportCards
    }, null, 2)}\n`, 'utf8');
    await fs.writeFile(path.join(reviewRoot, 'index.html'), html, 'utf8');
    console.log(`Built review page for ${sortedCards.length} cards.`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
