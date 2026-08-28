const STORAGE_LANG = 'printmomentum-landing-lang'
const STORAGE_THEME = 'printmomentum-landing-theme'
const HEALTH_URL = 'https://app.printmomentum.com/api/v1/health'
const ACCESS_EMAIL = 'aykutemyeyalcin@gmail.com'

function detectLang() {
  const stored = localStorage.getItem(STORAGE_LANG)
  if (stored === 'en' || stored === 'tr') return stored
  return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

function detectTheme() {
  const stored = localStorage.getItem(STORAGE_THEME)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function t(key, locale, vars = {}) {
  let text = window.PM_I18N[locale]?.[key] ?? window.PM_I18N.en[key] ?? key
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replace(`{${name}}`, value)
  })
  return text
}

function applyI18n(locale) {
  document.documentElement.lang = locale
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n')
    node.textContent = t(key, locale)
  })
  document.querySelectorAll('[data-i18n-attr]').forEach((node) => {
    const spec = node.getAttribute('data-i18n-attr')
    const [attr, key] = spec.split(':')
    node.setAttribute(attr, t(key, locale))
  })
  document.title = t('meta.title', locale)
  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.classList.toggle('is-on', button.getAttribute('data-lang') === locale)
  })
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = theme === 'dark' ? '#0f1419' : '#f5f7fa'
  const toggle = document.getElementById('theme-toggle')
  const label = toggle?.querySelector('[data-i18n]') ?? toggle
  if (label) label.textContent = theme === 'dark' ? t('theme.light', currentLang) : t('theme.dark', currentLang)
}

let currentLang = detectLang()
let currentTheme = detectTheme()

document.getElementById('year').textContent = String(new Date().getFullYear())
applyI18n(currentLang)
applyTheme(currentTheme)

document.querySelectorAll('[data-lang]').forEach((button) => {
  button.addEventListener('click', () => {
    currentLang = button.getAttribute('data-lang')
    localStorage.setItem(STORAGE_LANG, currentLang)
    applyI18n(currentLang)
    applyTheme(currentTheme)
    loadHealth()
  })
})

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark'
  localStorage.setItem(STORAGE_THEME, currentTheme)
  applyTheme(currentTheme)
})

const navToggle = document.querySelector('.nav-toggle')
const siteNav = document.getElementById('site-nav')
navToggle?.addEventListener('click', () => {
  const open = siteNav?.classList.toggle('is-open')
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false')
})

siteNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    siteNav.classList.remove('is-open')
    navToggle?.setAttribute('aria-expanded', 'false')
  })
})

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const revealNodes = document.querySelectorAll('.reveal')
if (reducedMotion || !('IntersectionObserver' in window)) {
  revealNodes.forEach((node) => node.classList.add('is-visible'))
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    },
    { rootMargin: '0px 0px -8% 0px' },
  )
  revealNodes.forEach((node) => observer.observe(node))
}

async function loadHealth() {
  const statsLine = document.getElementById('stats-line')
  if (!statsLine) return
  try {
    const response = await fetch(HEALTH_URL)
    if (!response.ok) throw new Error('health failed')
    const health = await response.json()
    const count = new Intl.NumberFormat(currentLang === 'tr' ? 'tr-TR' : 'en-US').format(
      health.indexedListings ?? 0,
    )
    const status =
      health.status === 'ok' && health.lastOutcome !== 'error'
        ? t('stats.live', currentLang)
        : t('stats.error', currentLang)
    statsLine.textContent = t('stats.line', currentLang, { count, status })
    if (status === t('stats.live', currentLang)) statsLine.classList.add('is-live')
  } catch {
    statsLine.textContent = t('stats.error', currentLang)
  }
}

loadHealth()

document.getElementById('access-form')?.addEventListener('submit', (event) => {
  event.preventDefault()
  const form = event.currentTarget
  const data = new FormData(form)
  const name = String(data.get('name') || '').trim()
  const email = String(data.get('email') || '').trim()
  const message = String(data.get('message') || '').trim()
  const subject = encodeURIComponent('PrintMomentum beta access request')
  const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`)
  window.location.href = `mailto:${ACCESS_EMAIL}?subject=${subject}&body=${body}`
  const success = document.getElementById('access-success')
  if (success) success.hidden = false
})
