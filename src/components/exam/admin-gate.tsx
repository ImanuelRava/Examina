'use client'

import { ReactNode, useEffect, useState } from 'react'
import { KeyRound, Loader2, Lock } from 'lucide-react'
import { api } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

/**
 * Wraps admin views: shows a login card until the admin cookie is verified.
 * Password is configured via the ADMIN_PASSWORD environment variable.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const [status, setStatus] = useState<'checking' | 'anon' | 'authed'>('checking')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api<{ authenticated: boolean }>('/api/admin/session')
      .then(({ authenticated }) => alive && setStatus(authenticated ? 'authed' : 'anon'))
      .catch(() => alive && setStatus('anon'))
    return () => {
      alive = false
    }
  }, [])

  async function handleLogin() {
    if (!password) return
    setBusy(true)
    setError(null)
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) })
      setStatus('authed')
      setPassword('')
      toast({ title: 'Welcome back, admin' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Checking session…
      </div>
    )
  }

  if (status === 'anon') {
    return (
      <div className="mx-auto max-w-sm py-10">
        <div className="rounded-2xl border border-zinc-200 p-8">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200">
            <KeyRound className="h-5 w-5 text-zinc-900" aria-hidden="true" />
          </span>
          <h1 className="mt-6 text-xl font-semibold tracking-tight text-zinc-900">Admin login</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
            Enter the admin password to manage exams and view results.
          </p>

          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              handleLogin()
            }}
          >
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                aria-hidden="true"
              />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
                className="pl-9"
                autoFocus
                aria-label="Admin password"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full h-11" disabled={busy || !password}>
              {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />}
              Sign in
            </Button>
          </form>

          <p className="mt-5 rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-500">
            Demo password: <span className="font-mono font-medium text-zinc-700">examina-admin</span> — change it via
            the <span className="font-mono">ADMIN_PASSWORD</span> environment variable.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
