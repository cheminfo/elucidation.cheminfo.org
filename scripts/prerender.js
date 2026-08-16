import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { SITE_NAME, SITE_URL, everyPage } from '../src/state/pageMeta.ts';

// A static image has no server to rewrite the head per request, so the build
// writes one real file per address instead. Without this the whole site is one
// page to a crawler: the same title, the same description, one search result.
const DIST = join(import.meta.dirname, '../dist');
const template = readFileSync(join(DIST, 'index.html'), 'utf8');

const pages = everyPage();
for (const page of pages) {
  const path =
    page.canonicalPath === '/'
      ? join(DIST, 'index.html')
      : join(DIST, page.canonicalPath.slice(1), 'index.html');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderPage(template, page));
}

writeFileSync(join(DIST, 'sitemap.xml'), renderSitemap(pages));

// eslint-disable-next-line no-console -- a build step says what it wrote
console.log(`prerendered ${pages.length} pages and a sitemap into dist`);

/**
 * One page of the site, with the head of the address it answers.
 * @param {string} html - The page vite built.
 * @param {import('../src/state/pageMeta.ts').PageMeta} page - Its address.
 * @returns {string} The page, titled and described as itself.
 */
function renderPage(html, page) {
  const title = `${page.title} — ${SITE_NAME}`;
  const canonical = `${SITE_URL}${page.canonicalPath}`;

  const head = [
    `<link rel="canonical" href="${escapeAttribute(canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${escapeAttribute(title)}" />`,
    `<meta property="og:description" content="${escapeAttribute(page.description)}" />`,
    `<meta property="og:url" content="${escapeAttribute(canonical)}" />`,
    `<meta property="og:image" content="${SITE_URL}/og.png" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n    ');

  const titled = html.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeText(title)}</title>`,
  );
  const described = titled.replace(
    /<meta[^>]*name="description"[^>]*>/,
    `<meta name="description" content="${escapeAttribute(page.description)}" />`,
  );
  return described.replace('</head>', `  ${head}\n  </head>`);
}

/**
 * The sitemap, listing every address the site answers.
 * @param {import('../src/state/pageMeta.ts').PageMeta[]} pages - Every page.
 * @returns {string} The XML document.
 */
function renderSitemap(pages) {
  const urls = pages
    .map(
      (page) =>
        `  <url><loc>${escapeText(`${SITE_URL}${page.canonicalPath}`)}</loc></url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function escapeAttribute(value) {
  return escapeText(value).replaceAll('"', '&quot;');
}

function escapeText(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
