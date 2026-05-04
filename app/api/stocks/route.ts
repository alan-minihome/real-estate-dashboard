import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

interface UniverseRow {
  ticker: string
  name: string | null
  screened_at: string
  overall_pass: number | null
  buy_signal: number | null
  signal_reason: string | null
  checks_json: string | null
  criteria_json: string | null
  eps_growth: number | null
  div_growth_5y: number | null
  div_yield: number | null
  div_yield_5y: number | null
}

export function GET() {
  try {
    const db = getDb()

    const stocks = db.prepare(`
      SELECT s.* FROM stock_data s
      INNER JOIN (
        SELECT ticker, MAX(fetched_at) AS max_at FROM stock_data GROUP BY ticker
      ) t ON s.ticker = t.ticker AND s.fetched_at = t.max_at
    `).all()

    // 단일 소스: universe_screening (S&P500 전체 스캔 결과)
    // screening_results 대신 universe_screening을 모든 페이지의 기준 데이터로 사용
    const universeRows = db.prepare(`
      SELECT u.* FROM universe_screening u
      INNER JOIN (
        SELECT ticker, MAX(screened_at) AS max_at FROM universe_screening GROUP BY ticker
      ) t ON u.ticker = t.ticker AND u.screened_at = t.max_at
    `).all() as UniverseRow[]

    // checks_json → pass_* 개별 컬럼으로 변환 (하위 페이지 호환)
    const screening = universeRows.map(u => {
      let checks: Record<string, number | null> = {}
      if (u.checks_json) {
        try {
          checks = typeof u.checks_json === 'string'
            ? JSON.parse(u.checks_json)
            : u.checks_json as Record<string, number | null>
        } catch { /* ignore */ }
      }
      return {
        ticker:          u.ticker,
        name:            u.name ?? null,
        screened_at:     u.screened_at,
        overall_pass:    u.overall_pass,
        buy_signal:      u.buy_signal,
        signal_reason:   u.signal_reason,
        pass_payout:     checks.payout_ratio_max   ?? null,
        pass_div_growth: checks.div_growth_5y_min  ?? null,
        pass_peg:        checks.peg_max            ?? null,
        pass_de:         checks.de_ratio_max       ?? null,
        pass_roe:        checks.roe_min            ?? null,
        pass_eps:        checks.eps_growth_min     ?? null,
        eps_growth:      u.eps_growth              ?? null,
        div_growth_5y:   u.div_growth_5y           ?? null,
        div_yield:       u.div_yield               ?? null,
        div_yield_5y:    u.div_yield_5y            ?? null,
      }
    })

    // 커스텀 감시 목록 (없으면 빈 배열)
    let customWatchlist: unknown[] = []
    try {
      const tableExists = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='custom_watchlist'"
      ).get()
      if (tableExists) {
        customWatchlist = db.prepare('SELECT * FROM custom_watchlist ORDER BY added_at DESC').all()
      }
    } catch { /* 테이블 없으면 무시 */ }

    return NextResponse.json({ stocks, screening, customWatchlist })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
