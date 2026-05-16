import { NextRequest, NextResponse } from 'next/server'
import { cacheGet, cacheSet, saveHistory } from '@/lib/db'

const BASE = 'https://realtyprice.kr:447'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const address = searchParams.get('address') ?? ''

  if (!address) return NextResponse.json({ error: 'address 필수 (예: 서울 강남구 삼성동 1)' }, { status: 400 })

  const cacheKey = `landprice:${address}`
  const cached = cacheGet<unknown>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const res = await fetch(`${BASE}/gongsijiga?address=${encodeURIComponent(address)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) return NextResponse.json({ error: '공시지가 조회 실패', status: res.status }, { status: 502 })
  const data = await res.json()
  cacheSet(cacheKey, data, 24 * 60 * 60 * 1000) // 24h (연 1회 갱신)
  saveHistory('land-price', address)
  return NextResponse.json(data)
}
