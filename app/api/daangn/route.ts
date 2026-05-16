import { NextRequest, NextResponse } from 'next/server'
import { cacheGet, cacheSet, saveHistory } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const region = searchParams.get('region') ?? ''
  const salesType = searchParams.get('salesType') ?? ''
  const tradeType = searchParams.get('tradeType') ?? ''
  const limit = parseInt(searchParams.get('limit') ?? '20', 10)

  if (!region) return NextResponse.json({ error: 'region 필수' }, { status: 400 })

  const cacheKey = `daangn:${region}:${salesType}:${tradeType}:${limit}`
  const cached = cacheGet<unknown>(cacheKey)
  if (cached) return NextResponse.json(cached)

  // 1단계: 지역 ID 조회
  const regionRes = await fetch(
    `https://www.daangn.com/kr/api/v1/regions/keyword?keyword=${encodeURIComponent(region)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } }
  )
  if (!regionRes.ok) return NextResponse.json({ error: '지역 조회 실패' }, { status: 502 })
  const regionData = await regionRes.json()
  const regions: Array<{ id: string; name: string; name1?: string; name2?: string; name3?: string; depth?: number }> =
    regionData.regions ?? regionData.data ?? []

  if (regions.length === 0) return NextResponse.json({ error: '지역을 찾을 수 없습니다', region }, { status: 404 })

  // 우선순위: 정확일치 → 서울 depth=3 → 첫 번째
  const exact = regions.find(r => [r.name, r.name1, r.name2, r.name3].includes(region))
  const seoul3 = regions.find(r => r.depth === 3 && r.name?.includes('서울'))
  const chosen = exact ?? seoul3 ?? regions[0]

  // 2단계: 매물 검색
  const inParam = `${chosen.name}-${chosen.id}`
  const searchUrl = `https://www.daangn.com/kr/realty/?in=${encodeURIComponent(inParam)}&_data=routes/kr.realty._index`
  const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } })
  if (!searchRes.ok) return NextResponse.json({ error: '매물 조회 실패' }, { status: 502 })
  const searchData = await searchRes.json()

  let articles = searchData.articles ?? searchData.data?.articles ?? []
  if (salesType) articles = articles.filter((a: { salesType?: string }) => a.salesType === salesType)
  if (tradeType) articles = articles.filter((a: { trade?: string }) => a.trade === tradeType)
  articles = articles.slice(0, limit)

  const result = { effective_region: chosen.name, region_id: chosen.id, articles, total: articles.length }
  cacheSet(cacheKey, result, 30 * 60 * 1000) // 30min
  saveHistory('daangn', `${region} ${salesType} ${tradeType}`)
  return NextResponse.json(result)
}
