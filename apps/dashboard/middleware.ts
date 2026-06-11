import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC = ['/auth/login', '/auth/register', '/api']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isPublic = PUBLIC.some(p => pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  // Token check is client-side only (localStorage).
  // Redirect to login and let client re-check.
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
