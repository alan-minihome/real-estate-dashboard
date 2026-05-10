import { NextResponse } from 'next/server'
import { createHash, createHmac } from 'crypto'

export async function POST(req: Request) {
  const { username, password } = await req.json()

  const expectedUser = process.env.AUTH_USERNAME
  const expectedHash = process.env.AUTH_PASSWORD_HASH
  const secret       = process.env.AUTH_SECRET

  if (!expectedUser || !expectedHash || !secret) {
    return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 })
  }

  const pwHash = createHash('sha256').update(password ?? '').digest('hex')

  if (username !== expectedUser || pwHash !== expectedHash) {
    return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' }, { status: 401 })
  }

  // 세션 토큰 = HMAC("session", secret) — 서버 재시작 후에도 유효
  const token = createHmac('sha256', secret).update('session').digest('hex')

  const res = NextResponse.json({ ok: true })
  res.cookies.set('auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    // maxAge 미설정 → 세션 쿠키 (브라우저 닫으면 만료)
  })
  return res
}
