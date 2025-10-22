// my-app/components/assistant-ui/tool-fallback.tsx
'use client'

import React from 'react'

type ToolFallbackProps = {
  children?: React.ReactNode
}

/**
 * Provide both named and default export so imports like:
 * import { ToolFallback } from "@/components/assistant-ui/tool-fallback"
 * continue to work.
 */

export function ToolFallback({ children }: ToolFallbackProps) {
  return (
    <div className="w-full p-3 rounded-md bg-gray-50 dark:bg-gray-800 text-sm">
      {children ?? <div className="text-muted">Tool fell back — no UI provided.</div>}
    </div>
  )
}

export default ToolFallback

