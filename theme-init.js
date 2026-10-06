// Set the theme before first paint so dark-mode visitors don't see a light flash.
// Loaded as a tiny blocking script in <head> (an external file, so the CSP needs no 'unsafe-inline').
try {
  var pmTheme = localStorage.getItem('printmomentum-landing-theme')
  if (pmTheme !== 'light' && pmTheme !== 'dark') {
    pmTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  document.documentElement.setAttribute('data-theme', pmTheme)
} catch (e) {}
