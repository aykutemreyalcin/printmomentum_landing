// Free phrase risk check (/trademark-check/ and /tr/trademark-check/).
// Calls the public API on the same origin (Caddy proxies /api to the API). The API checks the phrase
// against our own trademark watchlist only, never Etsy data. Text comes from i18n.js; results are
// built with DOM nodes, never innerHTML.
;(function () {
  const ENDPOINT = '/api/v1/public/phrase-check'
  const TIMEOUT_MS = 8000
  const MAX_LENGTH = 200

  const form = document.getElementById('phrase-form')
  const input = document.getElementById('phrase-input')
  const submit = document.getElementById('phrase-submit')
  const result = document.getElementById('phrase-result')
  const errorEl = document.getElementById('phrase-error')
  const high = document.getElementById('phrase-high')
  const none = document.getElementById('phrase-none')
  const matches = document.getElementById('phrase-matches')
  const legal = document.getElementById('phrase-legal')
  if (!form || !input || !submit || !result) return

  function lang() {
    return document.documentElement.lang === 'tr' ? 'tr' : 'en'
  }

  function text(key) {
    const dicts = window.PM_I18N || {}
    return dicts[lang()]?.[key] ?? dicts.en?.[key] ?? ''
  }

  function show(state, found) {
    result.hidden = false
    errorEl.hidden = state !== 'error'
    high.hidden = state !== 'high'
    none.hidden = state !== 'none'
    legal.hidden = state === 'error'
    if (state === 'high') {
      matches.replaceChildren(
        ...found.map((name) => {
          const li = document.createElement('li')
          const mark = document.createElement('mark')
          mark.textContent = name
          li.append(mark)
          return li
        }),
      )
    }
  }

  function showError(key) {
    errorEl.textContent = text(key)
    show('error')
  }

  function setBusy(busy) {
    submit.disabled = busy
    submit.textContent = text(busy ? 'check.checking' : 'check.submit')
    form.setAttribute('aria-busy', busy ? 'true' : 'false')
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const phrase = input.value.trim()
    if (!phrase || phrase.length > MAX_LENGTH) {
      showError('check.errorEmpty')
      input.focus()
      return
    }
    setBusy(true)
    const controller = 'AbortController' in window ? new AbortController() : null
    const timer = controller ? window.setTimeout(() => controller.abort(), TIMEOUT_MS) : null
    try {
      const response = await fetch(`${ENDPOINT}?q=${encodeURIComponent(phrase)}`, {
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        ...(controller ? { signal: controller.signal } : {}),
      })
      if (response.status === 429) return showError('check.errorRate')
      if (response.status === 400) return showError('check.errorEmpty')
      if (!response.ok) return showError('check.errorDown')
      const body = await response.json()
      const found = Array.isArray(body?.matches) ? body.matches.filter((m) => typeof m === 'string') : []
      if (body?.risk === 'high' && found.length) show('high', found)
      else if (body?.risk === 'not_found') show('none')
      else showError('check.errorDown')
    } catch {
      showError('check.errorDown')
    } finally {
      if (timer) window.clearTimeout(timer)
      setBusy(false)
    }
  })
})()
