// my-app/components/ui/theme-toggle.tsx
'use client'

import React, { JSX, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { FiSun, FiMoon } from 'react-icons/fi'

export function ThemeToggle(): JSX.Element | null {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  const current = theme === 'system' ? systemTheme : theme

  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(current === 'dark' ? 'light' : 'dark')}
      className="p-2 rounded-md hover:bg-gray-200/5 focus:outline-none"
      title="Toggle dark / light"
    >
      {current === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
    </button>
  )
}

export default ThemeToggle
