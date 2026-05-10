import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth/login']

// Web Crypto API (Edge Runtime 호환)
async function computeHmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 공개 경로 통과
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  // 정적 파일 통과
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next()

  const secret = process.env.AUTH_SECRET
  if (!secret) return NextResponse.next() // 설정 없으면 통과

  const token    = req.cookies.get('auth_token')?.value
  const expected = await computeHmac(secret, 'session')

  if (!token || token !== expected) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
