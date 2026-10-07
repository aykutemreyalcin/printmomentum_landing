const STORAGE_LANG = 'printmomentum-landing-lang'
const STORAGE_THEME = 'printmomentum-landing-theme'
const HEALTH_URL = 'https://app.printmomentum.com/api/v1/health'
const HEALTH_TIMEOUT_MS = 5000
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

// Some pages exist as two static files, English at /x/ and Turkish at /tr/x/ (body[data-static-lang]):
// the home page, /how-we-measure/ and /trademark-check/. Their hreflang links name the other version.
const HOME_PATHS = { en: '/', tr: '/tr/' }
const isStaticLangPage = () => Boolean(document.body?.hasAttribute('data-static-lang'))

function langFromPath() {
  if (!isStaticLangPage()) return null
  return window.location.pathname.startsWith('/tr/') || window.location.pathname === '/tr' ? 'tr' : 'en'
}

function pathForLang(locale) {
  const link = document.querySelector(`link[rel="alternate"][hreflang="${locale}"]`)
  if (link) {
    try {
      return new URL(link.getAttribute('href'), window.location.href).pathname
    } catch {
      /* fall through */
    }
  }
  return HOME_PATHS[locale]
}

function detectLang() {
  const fromPath = langFromPath()
  if (fromPath === 'tr') return 'tr'
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
  // [[word]] in a translation becomes a <mark>; built with DOM nodes, never innerHTML.
  document.querySelectorAll('[data-i18n-mark]').forEach((node) => {
    const text = t(node.getAttribute('data-i18n-mark'), locale)
    if (text == null) return
    node.replaceChildren(
      ...text.split(/(\[\[[^\]]+\]\])/).filter(Boolean).map((part) => {
        if (!part.startsWith('[[')) return document.createTextNode(part)
        const mark = document.createElement('mark')
        mark.textContent = part.slice(2, -2)
        return mark
      }),
    )
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

// Old ?lang= links to a static-language page go to the static page for that language.
function redirectOldLangUrl() {
  const fromUrl = langFromUrl()
  if (!isStaticLangPage() || !fromUrl) return false
  const target = pathForLang(fromUrl)
  if (window.location.pathname === target) return false
  window.location.replace(`${target}${window.location.hash}`)
  return true
}

// On static-language pages, switching language opens the other static page; elsewhere it switches in place.
function goToLang(locale) {
  if (!isStaticLangPage()) return false
  const target = pathForLang(locale)
  if (langFromPath() === locale && window.location.pathname === target) return false
  window.location.assign(`${target}${window.location.hash}`)
  return true
}

let currentLang = detectLang()
let currentTheme = detectTheme()

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = theme === 'dark' ? '#0e1116' : '#f6f7f9'
  const toggle = document.getElementById('theme-toggle')
  if (toggle) {
    const label = t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark', currentLang)
    toggle.setAttribute('aria-label', label)
    toggle.setAttribute('title', label)
  }
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
  const setOpen = (open) => {
    siteNav.classList.toggle('is-open', open)
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false')
  }
  navToggle.addEventListener('click', () => setOpen(!siteNav.classList.contains('is-open')))
  siteNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)))
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && siteNav.classList.contains('is-open')) {
      setOpen(false)
      navToggle.focus()
    }
  })
  window.matchMedia('(min-width: 961px)').addEventListener('change', (event) => {
    if (event.matches) setOpen(false)
  })
}

// Campaign pass-through (first-party, no cookies): links to the app carry this visit's utm_* values and, when
// the visitor came from another site, that site's host as `ref`, so the app can record where sign-ups come from.
// Kept for this tab only (sessionStorage); nothing is sent anywhere by this page.
const APP_ORIGIN = 'https://app.printmomentum.com'
const STORAGE_CAMPAIGN = 'printmomentum-landing-campaign'
const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign']

function readCampaign() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(STORAGE_CAMPAIGN) || 'null')
    if (stored && typeof stored === 'object') return stored
  } catch {
    /* storage unavailable or bad value */
  }
  return null
}

function referrerHost() {
  try {
    if (!document.referrer) return null
    const host = new URL(document.referrer).hostname.toLowerCase()
    if (host === window.location.hostname || host.endsWith('printmomentum.com')) return null
    return host.startsWith('www.') ? host.slice(4) : host
  } catch {
    return null
  }
}

function currentCampaign() {
  const stored = readCampaign()
  if (stored) return stored // first page of the visit wins
  const params = new URLSearchParams(window.location.search)
  const campaign = {}
  CAMPAIGN_KEYS.forEach((key) => {
    const value = (params.get(key) || '').trim().slice(0, 150)
    if (value) campaign[key] = value
  })
  const ref = referrerHost()
  if (ref) campaign.ref = ref
  if (!Object.keys(campaign).length) return null
  try {
    window.sessionStorage.setItem(STORAGE_CAMPAIGN, JSON.stringify(campaign))
  } catch {
    /* not remembered across pages; the current page still passes it on */
  }
  return campaign
}

function passCampaignToApp() {
  const campaign = currentCampaign()
  if (!campaign) return
  document.querySelectorAll(`a[href^="${APP_ORIGIN}"]`).forEach((link) => {
    try {
      const url = new URL(link.getAttribute('href'))
      Object.entries(campaign).forEach(([key, value]) => {
        if (!url.searchParams.has(key)) url.searchParams.set(key, value)
      })
      link.setAttribute('href', url.toString())
    } catch {
      /* leave the link as it is */
    }
  })
}

function boot() {
  const yearEl = document.getElementById('year')
  if (yearEl) yearEl.textContent = String(new Date().getFullYear())
  if (redirectOldLangUrl()) return
  applyI18n(currentLang)
  applyTheme(currentTheme)

  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.addEventListener('click', () => {
      currentLang = button.getAttribute('data-lang')
      writeStorage(STORAGE_LANG, currentLang)
      if (goToLang(currentLang)) return
      applyI18n(currentLang)
      applyTheme(currentTheme)
      renderStats()
    })
  })

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark'
    writeStorage(STORAGE_THEME, currentTheme)
    applyTheme(currentTheme)
  })

  initNav()
  passCampaignToApp()
  loadHealth()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot)
} else {
  boot()
}
