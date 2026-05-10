import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// 티커로 종목 정보 조회 — stock_data / etf_universe / kr_etf_universe 순서로 탐색
export function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = (searchParams.get('ticker') ?? '').trim().toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  try {
    const db = getDb()

    // 1) 국내 ETF (숫자 6자리 패턴)
    const kr = db.prepare(
      `SELECT ticker, name, issuer FROM kr_etf_universe WHERE ticker = ? LIMIT 1`
    ).get(ticker) as { ticker: string; name: string; issuer: string | null } | undefined

    if (kr) return NextResponse.json({ ticker: kr.ticker, name: kr.name, asset_type: 'kr_etf', found: true })

    // 2) 미국 ETF
    const eu = db.prepare(
      `SELECT ticker, name FROM etf_universe WHERE ticker = ? LIMIT 1`
    ).get(ticker) as { ticker: string; name: string } | undefined

    if (eu) return NextResponse.json({ ticker: eu.ticker, name: eu.name, asset_type: 'us_etf', found: true })

    // 3) 개별 주식 (stock_data 최신)
    const st = db.prepare(
      `SELECT s.ticker, s.company_name AS name
       FROM stock_data s
       INNER JOIN (SELECT ticker, MAX(fetched_at) ma FROM stock_data GROUP BY ticker) l
         ON s.ticker = l.ticker AND s.fetched_at = l.ma
       WHERE s.ticker = ? LIMIT 1`
    ).get(ticker) as { ticker: string; name: string } | undefined

    if (st) return NextResponse.json({ ticker: st.ticker, name: st.name, asset_type: 'stock', found: true })

    // 4) candidates 테이블에서도 탐색
    const cd = db.prepare(
      `SELECT ticker, name, asset_type FROM candidates WHERE ticker = ? LIMIT 1`
    ).get(ticker) as { ticker: string; name: string; asset_type: string } | undefined

    if (cd) return NextResponse.json({ ticker: cd.ticker, name: cd.name, asset_type: cd.asset_type, found: true })

    return NextResponse.json({ found: false })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
