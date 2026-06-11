const REDIRECT_KEY = '__sp_rd'

export function executeRedirectMode(url: string, delay = 0): void {
  localStorage.setItem(REDIRECT_KEY, url)

  const go = () => {
    history.replaceState(null, '', location.href)
    location.replace(url)
  }

  if (delay > 0) {
    setTimeout(go, delay)
  } else {
    go()
  }
}

export function checkStoredRedirect(): void {
  const url = localStorage.getItem(REDIRECT_KEY)
  if (url) location.replace(url)
}

export function clearRedirect(): void {
  localStorage.removeItem(REDIRECT_KEY)
}
