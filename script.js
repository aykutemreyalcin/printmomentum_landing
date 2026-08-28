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
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const finePointer = window.matchMedia('(pointer: fine)').matches

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

function initHeroLines() {
  document.querySelectorAll('.hero-line').forEach((line) => {
    line.classList.add('is-in')
  })
}

function initReveal() {
  const revealNodes = document.querySelectorAll('.reveal')
  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealNodes.forEach((node) => node.classList.add('is-visible'))
    document.querySelectorAll('.stagger-item').forEach((node) => node.classList.add('is-visible'))
    return
  }

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        entry.target.querySelectorAll('.stagger-item').forEach((item, index) => {
          window.setTimeout(() => item.classList.add('is-visible'), index * 70)
        })
        revealObserver.unobserve(entry.target)
      })
    },
    { rootMargin: '0px 0px -8% 0px' },
  )
  revealNodes.forEach((node) => revealObserver.observe(node))
}

function initHeaderScroll() {
  const header = document.querySelector('.site-header')
  if (!header) return
  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8)
  }
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
}

function initNavSpy() {
  const links = [...document.querySelectorAll('.site-nav .nav-link[href^="#"]')]
  if (!links.length) return
  const sections = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean)

  const setActive = () => {
    const y = window.scrollY + 120
    let current = sections[0]
    sections.forEach((section) => {
      if (section.offsetTop <= y) current = section
    })
    links.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${current.id}`)
    })
  }

  setActive()
  window.addEventListener('scroll', setActive, { passive: true })
}

function initMockSegments() {
  document.querySelectorAll('.mock-segmented').forEach((group) => {
    group.querySelectorAll('.mock-seg').forEach((button) => {
      button.addEventListener('click', () => {
        group.querySelectorAll('.mock-seg').forEach((item) => item.classList.remove('is-on'))
        button.classList.add('is-on')
      })
    })
  })
}

function initTilt() {
  if (reducedMotion || !finePointer) return
  document.querySelectorAll('.tilt-target').forEach((target) => {
    target.addEventListener('mousemove', (event) => {
      const rect = target.getBoundingClientRect()
      const px = (event.clientX - rect.left) / rect.width - 0.5
      const py = (event.clientY - rect.top) / rect.height - 0.5
      target.style.transform = `perspective(900px) rotateX(${py * -4}deg) rotateY(${px * 4}deg)`
      target.classList.add('is-tilting')
    })
    target.addEventListener('mouseleave', () => {
      target.style.transform = ''
      target.classList.remove('is-tilting')
    })
  })
}

function initCursorFx() {
  if (reducedMotion || !finePointer) return
  const root = document.documentElement
  const dot = document.querySelector('.cursor-dot')
  root.classList.add('has-cursor-fx')

  let targetX = window.innerWidth / 2
  let targetY = window.innerHeight / 2
  let currentX = targetX
  let currentY = targetY

  const interactiveSelector = 'a, button, summary, input, textarea, .mock-seg'

  window.addEventListener(
    'mousemove',
    (event) => {
      targetX = event.clientX
      targetY = event.clientY
      root.style.setProperty('--cursor-x', `${targetX}px`)
      root.style.setProperty('--cursor-y', `${targetY}px`)
    },
    { passive: true },
  )

  window.addEventListener(
    'mouseover',
    (event) => {
      if (!(event.target instanceof Element)) return
      dot?.classList.toggle('is-hover', Boolean(event.target.closest(interactiveSelector)))
    },
    { passive: true },
  )

  const tick = () => {
    currentX += (targetX - currentX) * 0.16
    currentY += (targetY - currentY) * 0.16
    if (dot) {
      dot.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`
    }
    requestAnimationFrame(tick)
  }
  tick()
}

function animateCount(node, target) {
  if (reducedMotion || !target) {
    return String(target)
  }
  const duration = 900
  const start = performance.now()
  const from = 0
  const formatter = new Intl.NumberFormat(currentLang === 'tr' ? 'tr-TR' : 'en-US')

  return new Promise((resolve) => {
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      const value = Math.round(from + (target - from) * eased)
      node.dataset.count = String(value)
      resolve(formatter.format(value))
      if (progress < 1) {
        requestAnimationFrame(step)
      }
    }
    requestAnimationFrame(step)
  })
}

async function loadHealth() {
  const statsLine = document.getElementById('stats-line')
  if (!statsLine) return
  statsLine.textContent = t('stats.loading', currentLang)
  statsLine.classList.remove('is-live')

  try {
    const response = await fetch(HEALTH_URL)
    if (!response.ok) throw new Error('health failed')
    const health = await response.json()
    const countValue = health.indexedListings ?? 0
    const status =
      health.status === 'ok' && health.lastOutcome !== 'error'
        ? t('stats.live', currentLang)
        : t('stats.error', currentLang)

    if (!reducedMotion && countValue > 0) {
      const formatter = new Intl.NumberFormat(currentLang === 'tr' ? 'tr-TR' : 'en-US')
      const duration = 900
      const start = performance.now()
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1)
        const eased = 1 - (1 - progress) ** 3
        const value = Math.round(countValue * eased)
        statsLine.textContent = t('stats.line', currentLang, {
          count: formatter.format(value),
          status,
        })
        if (progress < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    } else {
      statsLine.textContent = t('stats.line', currentLang, {
        count: new Intl.NumberFormat(currentLang === 'tr' ? 'tr-TR' : 'en-US').format(countValue),
        status,
      })
    }

    if (status === t('stats.live', currentLang)) statsLine.classList.add('is-live')
  } catch {
    statsLine.textContent = t('stats.error', currentLang)
  }
}

initHeroLines()
initReveal()
initHeaderScroll()
initNavSpy()
initMockSegments()
initTilt()
initCursorFx()
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
