import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware: adds baseline security headers to every response.
 *
 * Per-route admin auth is enforced inside each route handler via
 * `guardAdmin(req)`. This middleware focuses on HTTP-level hardening
 * that applies to all responses, not just admin routes.
 */
export const config = {
  // Run on every path; skip only Next internals.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

export function proxy(_req: NextRequest) {
  const res = NextResponse.next()
  // Force HTTPS in production (no-op on localhost / dev).
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  // Don't allow the admin cookie responses to be framed (clickjacking defense).
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // Allow same-origin scripts + MathJax CDN (used for PDF math rendering).
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://cdn.jsdelivr.net; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'"
  )
  return res
}
