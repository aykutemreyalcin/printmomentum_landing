const STORAGE_LANG = 'printmomentum-landing-lang'
const STORAGE_THEME = 'printmomentum-landing-theme'
const HEALTH_URL = 'https://app.printmomentum.com/api/v1/health'
const HEALTH_TIMEOUT_MS = 5000
const SITE_ORIGIN = 'https://printmomentum.com'
const LANGS = ['en', 'tr']

function readStorage(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage unavailable (private mode etc.) — preference just isn't remembered */
  }
}

function langFromUrl() {
  try {
    const value = new URLSearchParams(window.location.search).get('lang')
    return LANGS.includes(value) ? value : null
  } catch {
    return null
  }
}

function detectLang() {
  const fromUrl = langFromUrl()
  if (fromUrl) return fromUrl
  const stored = readStorage(STORAGE_LANG)
  if (LANGS.includes(stored)) return stored
  return (navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

function detectTheme() {
  const stored = readStorage(STORAGE_THEME)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const dictionaries = window.PM_I18N || { en: {}, tr: {} }

function t(key, locale, vars = {}) {
  let text = dictionaries[locale]?.[key] ?? dictionaries.en?.[key]
  if (text == null) return null
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replace(`{${name}}`, value)
  })
  return text
}

function numberLocale(locale) {
  return locale === 'tr' ? 'tr-TR' : 'en-US'
}

function applyI18n(locale) {
  document.documentElement.lang = locale
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const text = t(node.getAttribute('data-i18n'), locale)
    if (text != null) node.textContent = text
  })
  document.querySelectorAll('[data-i18n-attr]').forEach((node) => {
    node
      .getAttribute('data-i18n-attr')
      .split(';')
      .forEach((spec) => {
        const [attr, key] = spec.split(':').map((part) => part.trim())
        const text = t(key, locale)
        if (attr && text != null) node.setAttribute(attr, text)
      })
  })
  // Legal pages carry full EN and TR versions side by side.
  document.querySelectorAll('[data-lang-section]').forEach((node) => {
    node.hidden = node.getAttribute('data-lang-section') !== locale
  })
  document.querySelectorAll('[data-lang]').forEach((button) => {
    const on = button.getAttribute('data-lang') === locale
    button.classList.toggle('is-on', on)
    button.setAttribute('aria-pressed', on ? 'true' : 'false')
  })
}

function syncLangUrl(locale, explicit) {
  const canonical = document.querySelector('link[rel="canonical"]')
  const hasAlternates = Boolean(document.querySelector('link[rel="alternate"][hreflang]'))
  if (explicit) {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('lang', locale)
      window.history.replaceState(null, '', url)
    } catch {
      /* ignore */
    }
  }
  if (canonical && hasAlternates && langFromUrl()) {
    canonical.href = `${SITE_ORIGIN}${window.location.pathname}?lang=${locale}`
  }
}

let currentLang = detectLang()
let currentTheme = detectTheme()

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = theme === 'dark' ? '#0f1419' : '#f5f7fa'
  const label = document.querySelector('#theme-toggle .theme-label')
  if (label) label.textContent = theme === 'dark' ? t('theme.light', currentLang) : t('theme.dark', currentLang)
}

let healthCount = null

function renderStats() {
  const statsLine = document.getElementById('stats-line')
  if (!statsLine) return
  if (healthCount == null || healthCount <= 0) {
    statsLine.textContent = t('stats.fallback', currentLang)
    return
  }
  // Rounded down so the "+" stays true between refreshes (e.g. 78.000+).
  const rounded = healthCount >= 1000 ? Math.floor(healthCount / 1000) * 1000 : healthCount
  statsLine.textContent = t('stats.line', currentLang, {
    count: new Intl.NumberFormat(numberLocale(currentLang)).format(rounded),
  })
}

async function loadHealth() {
  if (!document.getElementById('stats-line')) return
  renderStats()
  const controller = 'AbortController' in window ? new AbortController() : null
  const timer = controller ? window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS) : null
  try {
    const response = await fetch(HEALTH_URL, controller ? { signal: controller.signal } : undefined)
    if (!response.ok) return
    const health = await response.json()
    const count = Number(health?.indexedListings)
    if (Number.isFinite(count) && count > 0) {
      healthCount = count
      renderStats()
    }
  } catch {
    /* API unreachable: keep the plain fallback line */
  } finally {
    if (timer) window.clearTimeout(timer)
  }
}

function initNav() {
  const navToggle = document.querySelector('.nav-toggle')
  const siteNav = document.getElementById('site-nav')
  if (!navToggle || !siteNav) return
  navToggle.addEventListener('click', () => {
    const open = siteNav.classList.toggle('is-open')
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false')
  })
  siteNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      siteNav.classList.remove('is-open')
      navToggle.setAttribute('aria-expanded', 'false')
    })
  })
}

function initMockSegments() {
  document.querySelectorAll('.mock-segmented').forEach((group) => {
    const buttons = group.querySelectorAll('.mock-seg')
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        buttons.forEach((item) => item.classList.toggle('is-on', item === button))
      })
    })
  })
}

function boot() {
  const yearEl = document.getElementById('year')
  if (yearEl) yearEl.textContent = String(new Date().getFullYear())
  applyI18n(currentLang)
  applyTheme(currentTheme)
  syncLangUrl(currentLang, false)

  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.addEventListener('click', () => {
      currentLang = button.getAttribute('data-lang')
      writeStorage(STORAGE_LANG, currentLang)
      applyI18n(currentLang)
      applyTheme(currentTheme)
      syncLangUrl(currentLang, true)
      renderStats()
    })
  })

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark'
    writeStorage(STORAGE_THEME, currentTheme)
    applyTheme(currentTheme)
  })

  initNav()
  initMockSegments()
  loadHealth()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot)
} else {
  boot()
}
