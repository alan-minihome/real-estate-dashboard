import { NextRequest, NextResponse } from 'next/server'
import { cacheGet, cacheSet, saveHistory } from '@/lib/db'

const PROXY = 'https://k-skill-proxy.nomadamas.org'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') ?? ''
  const region = searchParams.get('region') ?? ''
  const keyword = searchParams.get('keyword') ?? ''
  const page = searchParams.get('page') ?? '1'
  const pageSize = searchParams.get('pageSize') ?? '20'

  const params = new URLSearchParams({ page, pageSize })
  if (status) params.set('status', status)
  if (region) params.set('region', region)
  if (keyword) params.set('keyword', keyword)

  const cacheKey = `lh:${params.toString()}`
  const cached = cacheGet<unknown>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const res = await fetch(`${PROXY}/v1/lh-notice/search?${params}`)
  if (!res.ok) return NextResponse.json({ error: 'LH 청약 조회 실패' }, { status: 502 })
  const data = await res.json()
  cacheSet(cacheKey, data, 30 * 60 * 1000) // 30min
  saveHistory('subscription', params.toString())
  return NextResponse.json(data)
}
