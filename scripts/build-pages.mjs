// Fills page text from i18n.js so crawlers and no-JS visitors see the real copy (see PAGES below):
//   index.html, how-we-measure/index.html, trademark-check/index.html
//                  English text (in place; each English page is also its template)
//   tr/...         Turkish text, lang="tr", self canonical, reciprocal hreflang, links to /tr/ pages
// Usage: node scripts/build-pages.mjs          (write)
//        node scripts/build-pages.mjs --check  (exit 1 if a page is out of date; used in CI)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGIN = 'https://printmomentum.com'
const check = process.argv.includes('--check')

const sandbox = { window: {} }
vm.runInNewContext(readFileSync(join(root, 'i18n.js'), 'utf8'), sandbox)
const dicts = sandbox.window.PM_I18N

const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s) => escText(s).replace(/"/g, '&quot;')
const escJson = (s) => JSON.stringify(s).slice(1, -1)

function lookup(dict, key) {
  const value = dict[key]
  if (typeof value !== 'string') throw new Error(`missing i18n key: ${key}`)
  return value
}

function fill(html, dict) {
  // Leaf elements with data-i18n="key": replace their text.
  html = html.replace(
    /<([a-z0-9]+)\b([^>]*?\sdata-i18n="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g,
    (_, tag, attrs, key) => `<${tag}${attrs}>${escText(lookup(dict, key))}</${tag}>`,
  )
  // data-i18n-mark="key": [[word]] becomes <mark>word</mark>.
  html = html.replace(
    /<([a-z0-9]+)\b([^>]*?\sdata-i18n-mark="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g,
    (_, tag, attrs, key) => {
      const body = lookup(dict, key)
        .split(/(\[\[[^\]]+\]\])/)
        .filter(Boolean)
        .map((part) => (part.startsWith('[[') ? `<mark>${escText(part.slice(2, -2))}</mark>` : escText(part)))
        .join('')
      return `<${tag}${attrs}>${body}</${tag}>`
    },
  )
  // data-i18n-attr="attr:key;attr:key": set those attributes.
  html = html.replace(/<[a-z0-9]+\b[^>]*\sdata-i18n-attr="([^"]+)"[^>]*>/g, (tagText, specs) => {
    for (const spec of specs.split(';')) {
      const [attr, key] = spec.split(':').map((part) => part.trim())
      const value = escAttr(lookup(dict, key))
      const re = new RegExp(`(\\s${attr}=")[^"]*(")`)
      tagText = re.test(tagText) ? tagText.replace(re, `$1${value}$2`) : tagText
    }
    return tagText
  })
  // JSON-LD description follows the page language.
  html = html.replace(/("description": ")[^"]*(")/, `$1${escJson(lookup(dict, 'meta.description'))}$2`)
  return html
}

// Pages that exist as two static files: the English template (also the English output) and a
// generated Turkish copy under /tr/. `path` is the public URL of the English page.
export const PAGES = [
  { path: '/', en: 'index.html', tr: 'tr/index.html' },
  { path: '/how-we-measure/', en: 'how-we-measure/index.html', tr: 'tr/how-we-measure/index.html' },
  { path: '/trademark-check/', en: 'trademark-check/index.html', tr: 'tr/trademark-check/index.html' },
]

function toTurkish(html, path) {
  const trPath = `/tr${path}`
  const swaps = [
    ['<html lang="en"', '<html lang="tr"'],
    [`<link rel="canonical" href="${ORIGIN}${path}" />`, `<link rel="canonical" href="${ORIGIN}${trPath}" />`],
    [`<meta property="og:url" content="${ORIGIN}${path}" />`, `<meta property="og:url" content="${ORIGIN}${trPath}" />`],
    ['<meta property="og:locale" content="en_US" />', '<meta property="og:locale" content="tr_TR" />'],
    ['<meta property="og:locale:alternate" content="tr_TR" />', '<meta property="og:locale:alternate" content="en_US" />'],
    ['class="pill is-on" data-lang="en" aria-pressed="true"', 'class="pill" data-lang="en" aria-pressed="false"'],
    ['class="pill" data-lang="tr" aria-pressed="false"', 'class="pill is-on" data-lang="tr" aria-pressed="true"'],
  ]
  // Only the home page carries JSON-LD.
  const optional = [
    [`"url": "${ORIGIN}/",\n        "applicationCategory"`, `"url": "${ORIGIN}/tr/",\n        "applicationCategory"`],
    ['"inLanguage": "en"', '"inLanguage": "tr"'],
  ]
  for (const [from, to] of swaps) {
    if (!html.includes(from)) throw new Error(`tr template ${path}: expected to find ${from}`)
    html = html.replace(from, to)
  }
  for (const [from, to] of optional) html = html.replace(from, to)
  // Internal links go to the Turkish version of each static page.
  html = html.replace(/href="\/(#[^"]*)?"/g, (_, hash = '') => `href="/tr/${hash}"`)
  for (const page of PAGES) {
    if (page.path === '/') continue
    html = html.replaceAll(`href="${page.path}`, `href="/tr${page.path}`)
  }
  // Turkish-only blocks (data-lang-section="tr") ship hidden in the English page and visible here.
  html = html.replaceAll('data-lang-section="tr" hidden', 'data-lang-section="tr"')
  return html
    .replaceAll('href="/privacy.html"', 'href="/privacy.html?lang=tr"')
    .replaceAll('href="/terms.html"', 'href="/terms.html?lang=tr"')
}

const GENERATED = '<!-- Generated by scripts/build-pages.mjs from {src} + i18n.js. Do not edit by hand. -->\n'
const outputs = {}
for (const page of PAGES) {
  const template = readFileSync(join(root, page.en), 'utf8')
  outputs[page.en] = fill(template, dicts.en)
  outputs[page.tr] = toTurkish(fill(template, dicts.tr), page.path).replace(
    '<!doctype html>\n',
    `<!doctype html>\n${GENERATED.replace('{src}', page.en)}`,
  )
}

let stale = 0
for (const [file, content] of Object.entries(outputs)) {
  const path = join(root, file)
  let current = null
  try {
    current = readFileSync(path, 'utf8')
  } catch {
    /* new file */
  }
  if (current === content) continue
  if (check) {
    console.error(`out of date: ${file} (run node scripts/build-pages.mjs)`)
    stale++
  } else {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
    console.log(`wrote ${file}`)
  }
}
if (stale) process.exit(1)
if (check) console.log(`pages OK: ${Object.keys(outputs).join(', ')} match i18n.js`)
