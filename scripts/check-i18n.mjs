// Checks that EN and TR have the same keys and that every key used in the HTML pages exists.
// Usage: node scripts/check-i18n.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sandbox = { window: {} }
vm.runInNewContext(readFileSync(join(root, 'i18n.js'), 'utf8'), sandbox)
const { en, tr } = sandbox.window.PM_I18N
const problems = []

for (const key of Object.keys(en)) if (!(key in tr)) problems.push(`missing in tr: ${key}`)
for (const key of Object.keys(tr)) if (!(key in en)) problems.push(`missing in en: ${key}`)
for (const [lang, dict] of Object.entries({ en, tr })) {
  for (const [key, value] of Object.entries(dict)) {
    if (typeof value !== 'string' || !value.trim()) problems.push(`empty ${lang}: ${key}`)
  }
}

const used = new Set()
for (const page of ['index.html', 'how-we-measure/index.html', 'trademark-check/index.html', 'privacy.html', 'terms.html']) {
  const html = readFileSync(join(root, page), 'utf8')
  for (const m of html.matchAll(/data-i18n(?:-mark)?="([^"]+)"/g)) used.add(m[1])
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const spec of m[1].split(';')) used.add(spec.split(':')[1].trim())
  }
}
// Keys referenced from scripts as quoted 'group.name' strings
for (const script of ['script.js', 'phrase-check.js']) {
  for (const m of readFileSync(join(root, script), 'utf8').matchAll(/'([a-z]+\.[a-zA-Z0-9.]+)'/g)) {
    if (m[1] in en) used.add(m[1])
  }
}
for (const key of used) if (!(key in en)) problems.push(`used but not defined: ${key}`)
for (const key of Object.keys(en)) if (!used.has(key)) problems.push(`defined but unused: ${key}`)

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`i18n OK: ${Object.keys(en).length} keys in en and tr, ${used.size} used`)
