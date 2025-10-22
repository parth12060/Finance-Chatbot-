// my-app/components/assistant-ui/composer.tsx
'use client'

import React, { useEffect, useRef, useState } from 'react'
import { FiUpload, FiSend, FiPlus } from 'react-icons/fi'

type ComposerProps = {
  onSendAction?: (text: string) => void
  initialText?: string
  autoSend?: boolean
}

export default function Composer({ onSendAction, initialText = '', autoSend = false }: ComposerProps) {
  const [text, setText] = useState(initialText)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const lastInitialRef = useRef<string>('')

  // update internal text when parent changes initialText
  useEffect(() => {
    if (initialText !== lastInitialRef.current) {
      lastInitialRef.current = initialText
      setText(initialText)
      // focus input so user sees it
      inputRef.current?.focus()
      if (autoSend && initialText.trim()) {
        // tiny timeout so state has applied
        setTimeout(() => {
          send(initialText)
        }, 50)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText, autoSend])

  function send(overrideText?: string) {
    const content = (overrideText ?? text).trim()
    if (!content) return
    onSendAction?.(content)
    setText('')
  }

  return (
    <div className="fixed left-0 right-0 bottom-4 flex justify-center pointer-events-none z-50">
      <div className="w-full max-w-4xl px-4 pointer-events-auto">
        <div className="rounded-2xl bg-gray-800 border border-gray-700 p-4 flex items-center gap-3">
          <button className="p-2 rounded-md hover:bg-gray-700">
            <FiPlus />
          </button>

          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Send a message..."
            className="flex-1 bg-transparent outline-none text-white placeholder:text-slate-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />

          <button className="p-2 rounded-md hover:bg-gray-700">
            <FiUpload />
          </button>

          <button
            className="ml-2 rounded-full bg-gray-700 p-2 hover:bg-gray-600"
            onClick={() => send()}
            aria-label="Send"
            title="Send"
          >
            <FiSend />
          </button>
        </div>
      </div>
    </div>
  )
}
