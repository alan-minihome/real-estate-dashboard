import { NextRequest, NextResponse } from 'next/server'
import { cacheGet, cacheSet, saveHistory } from '@/lib/db'

const BEOPMANG = 'https://api.beopmang.org'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const query = searchParams.get('q') ?? ''
  const type = searchParams.get('type') ?? 'law' // law | precedent | ordinance

  if (!query) return NextResponse.json({ error: 'q 필수' }, { status: 400 })

  const cacheKey = `law:${type}:${query}`
  const cached = cacheGet<unknown>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const endpoint =
    type === 'precedent' ? '/search_decisions' :
    type === 'ordinance' ? '/search_ordinance' :
    '/search_law'

  const res = await fetch(`${BEOPMANG}${endpoint}?q=${encodeURIComponent(query)}`)
  if (!res.ok) return NextResponse.json({ error: '법령 조회 실패', status: res.status }, { status: 502 })
  const data = await res.json()
  cacheSet(cacheKey, data, 60 * 60 * 1000) // 1h
  saveHistory('law', `${type}:${query}`)
  return NextResponse.json(data)
}
