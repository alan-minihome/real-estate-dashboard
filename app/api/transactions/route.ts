import { NextRequest, NextResponse } from 'next/server'
import { cacheGet, cacheSet, saveHistory } from '@/lib/db'

const PROXY = 'https://k-skill-proxy.nomadamas.org'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = searchParams.get('q') ?? ''
  const assetType = searchParams.get('assetType') ?? 'apartment'
  const dealType = searchParams.get('dealType') ?? 'trade'
  const dealYmd = searchParams.get('dealYmd') ?? ''
  const lawdCd = searchParams.get('lawdCd') ?? ''

  // 지역코드 조회 단계
  if (!lawdCd && q) {
    const cacheKey = `region:${q}`
    const cached = cacheGet<unknown>(cacheKey)
    if (cached) return NextResponse.json(cached)

    const res = await fetch(`${PROXY}/v1/real-estate/region-code?q=${encodeURIComponent(q)}`)
    if (!res.ok) return NextResponse.json({ error: '지역코드 조회 실패' }, { status: 502 })
    const data = await res.json()
    cacheSet(cacheKey, data, 24 * 60 * 60 * 1000) // 24h
    return NextResponse.json(data)
  }

  if (!lawdCd || !dealYmd) {
    return NextResponse.json({ error: 'lawdCd, dealYmd 필수' }, { status: 400 })
  }

  const cacheKey = `tx:${assetType}:${dealType}:${lawdCd}:${dealYmd}`
  const cached = cacheGet<unknown>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const url = `${PROXY}/v1/real-estate/${assetType}/${dealType}?lawd_cd=${lawdCd}&deal_ymd=${dealYmd}`
  const res = await fetch(url)
  if (!res.ok) return NextResponse.json({ error: '실거래가 조회 실패' }, { status: 502 })
  const data = await res.json()
  cacheSet(cacheKey, data, 60 * 60 * 1000) // 1h
  saveHistory('transactions', `${assetType}/${dealType} ${lawdCd} ${dealYmd}`)
  return NextResponse.json(data)
}
