// my-app/components/ui/avatar.tsx
'use client'

import React from 'react'
import Image from 'next/image'
import { signIn, signOut, useSession } from 'next-auth/react'

/**
 * Generic Avatar primitives (named exports) so existing imports like:
 * import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
 * kept working.
 */

/* ---------- Types ---------- */
type AvatarProps = React.HTMLAttributes<HTMLDivElement> & { className?: string }
type AvatarImageProps = {
  src?: string | null
  alt?: string
  size?: number
  className?: string
}

/* ---------- Named exports ---------- */

export const Avatar: React.FC<AvatarProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export const AvatarImage: React.FC<AvatarImageProps> = ({ src, alt = 'avatar', size = 36, className = '' }) => {
  // next/image required src not null; fallback to a local image if src falsy
  const imgSrc = src || '/default-avatar.png'
  return (
    <Image
      src={imgSrc}
      width={size}
      height={size}
      alt={alt}
      className={`object-cover ${className}`}
      // allow external images (ensure next.config.js allowed domain)
    />
  )
}

export const AvatarFallback: React.FC<{ children?: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-center w-full h-full text-white ${className}`}>
      {children}
    </div>
  )
}

/* ---------- Default export: Session-aware Avatar for header (kept for backwards compatibility) ---------- */
/**
 * Default export used in header: if user was signed in, show image and sign-out,
 * otherwise show a Sign in button. You kept this simple so header code could
 * import Avatar (default) as before if needed.
 */

export default function SessionAvatar({ size = 36 }: { size?: number }) {
  const { data: session } = useSession()

  if (!session) {
    return (
      <button
        onClick={() => signIn('google')}
        className="px-3 py-1 rounded-md border text-sm dark:border-neutral-700"
      >
        Sign in
      </button>
    )
  }

  const img = session.user?.image ?? '/default-avatar.png'
  const name = session.user?.name ?? session.user?.email

  return (
    <div className="flex items-center gap-2">
      <Avatar className="w-[40px] h-[40px]">
        <AvatarImage src={img} alt={String(name)} size={size} />
      </Avatar>
      <div className="flex flex-col text-sm">
        <span className="truncate max-w-[120px]">{name}</span>
        <button className="text-xs underline" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
