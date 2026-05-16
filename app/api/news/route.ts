import { NextRequest, NextResponse } from 'next/server'
import { cacheGet, cacheSet, saveHistory } from '@/lib/db'

const PROXY = 'https://k-skill-proxy.nomadamas.org'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const query = searchParams.get('q') ?? '부동산'
  const display = parseInt(searchParams.get('display') ?? '20', 10)
  const sort = searchParams.get('sort') ?? 'date'

  const cacheKey = `news:${query}:${display}:${sort}`
  const cached = cacheGet<unknown>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const params = new URLSearchParams({ query, display: String(display), sort })
  const res = await fetch(`${PROXY}/v1/naver/news?${params}`)
  if (!res.ok) return NextResponse.json({ error: '뉴스 조회 실패' }, { status: 502 })
  const data = await res.json()
  cacheSet(cacheKey, data, 15 * 60 * 1000) // 15min
  saveHistory('news', query)
  return NextResponse.json(data)
}
