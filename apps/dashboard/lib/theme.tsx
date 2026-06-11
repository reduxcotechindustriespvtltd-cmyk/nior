'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('nior-theme') as Theme | null
    if (stored === 'light' || stored === 'dark') setThemeState(stored)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('nior-theme', theme)
  }, [theme, ready])

  function setTheme(t: Theme) {
    setThemeState(t)
  }

  function toggleTheme() {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return { theme: 'dark' as Theme, toggleTheme: () => {}, setTheme: () => {} }
  }
  return ctx
}
