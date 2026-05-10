import { NextResponse } from 'next/server'

export function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('auth_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   0,
  })
  return res
}
