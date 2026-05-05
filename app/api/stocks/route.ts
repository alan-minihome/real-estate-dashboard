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

interface StockRow {
  ticker: string
  fetched_at: string
  price: number | null
  market_cap: number | null
  div_yield: number | null
  div_yield_5y: number | null
  div_amount: number | null
  payout_ratio: number | null
  div_growth_5y: number | null
  peg: number | null
  de_ratio: number | null
  roe: number | null
  eps_growth: number | null
  fcf_yield: number | null
  fcf_payout_ratio: number | null
  sector: string | null
  // Phase 1: 미래 성장성
  forward_eps: number | null
  forward_pe: number | null
  eps_growth_fwd: number | null
  revenue_growth: number | null
  analyst_rating: number | null
  // Phase 2: 리스크 필터
  debt_trend: string | null
  eps_revision_score: number | null
}

interface CustomWatchlistRow {
  ticker: string
  name: string | null
  sector: string | null
  tier: string | null
  years: number | null
  added_at: string
  note: string | null
}

export function GET() {
  try {
    const db = getDb()

    const stockRows = db.prepare(`
      SELECT s.* FROM stock_data s
      INNER JOIN (
        SELECT ticker, MAX(fetched_at) AS max_at FROM stock_data GROUP BY ticker
      ) t ON s.ticker = t.ticker AND s.fetched_at = t.max_at
    `).all() as StockRow[]

    // 직렬화 안전한 명시적 객체 반환 (raw SQLite Row 직접 노출 금지)
    const stocks = stockRows.map(s => ({
      ticker:           s.ticker,
      fetched_at:       s.fetched_at,
      price:            s.price           ?? null,
      market_cap:       s.market_cap      ?? null,
      div_yield:        s.div_yield       ?? null,
      div_yield_5y:     s.div_yield_5y    ?? null,
      div_amount:       s.div_amount      ?? null,
      payout_ratio:     s.payout_ratio    ?? null,
      div_growth_5y:    s.div_growth_5y   ?? null,
      peg:              s.peg             ?? null,
      de_ratio:         s.de_ratio        ?? null,
      roe:              s.roe             ?? null,
      eps_growth:       s.eps_growth      ?? null,
      fcf_yield:        s.fcf_yield       ?? null,
      fcf_payout_ratio: s.fcf_payout_ratio ?? null,
      sector:           s.sector          ?? null,
      forward_eps:      s.forward_eps     ?? null,
      forward_pe:       s.forward_pe      ?? null,
      eps_growth_fwd:   s.eps_growth_fwd  ?? null,
      revenue_growth:   s.revenue_growth  ?? null,
      analyst_rating:   s.analyst_rating  ?? null,
      debt_trend:           s.debt_trend           ?? null,
      eps_revision_score:   s.eps_revision_score   ?? null,
    }))

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
        ticker:           u.ticker,
        name:             u.name ?? null,
        screened_at:      u.screened_at,
        overall_pass:     u.overall_pass,
        buy_signal:       u.buy_signal,
        signal_reason:    u.signal_reason,
        // 기본 6개 기준 pass 컬럼
        pass_payout:      checks.payout_ratio_max    ?? null,
        pass_div_growth:  checks.div_growth_5y_min   ?? null,
        pass_peg:         checks.peg_max             ?? null,
        pass_de:          checks.de_ratio_max        ?? null,
        pass_roe:         checks.roe_min             ?? null,
        pass_eps:         checks.eps_growth_min      ?? null,
        // FCF / 배당수익률 / 시총 기준 (동적 추가 기준)
        pass_fcf_yield:   checks.fcf_yield_min        ?? null,
        pass_fcf_payout:  checks.fcf_payout_ratio_max ?? null,
        pass_div_yield:   checks.div_yield_min        ?? null,
        pass_market_cap:  checks.market_cap_min       ?? null,
        eps_growth:       u.eps_growth              ?? null,
        div_growth_5y:    u.div_growth_5y           ?? null,
        div_yield:        u.div_yield               ?? null,
        div_yield_5y:     u.div_yield_5y            ?? null,
      }
    })

    // 커스텀 감시 목록 (없으면 빈 배열) — 직렬화 안전한 명시적 객체 반환
    let customWatchlist: object[] = []
    try {
      const tableExists = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='custom_watchlist'"
      ).get()
      if (tableExists) {
        const cwRows = db.prepare('SELECT * FROM custom_watchlist ORDER BY added_at DESC').all() as CustomWatchlistRow[]
        customWatchlist = cwRows.map(r => ({
          ticker:   r.ticker,
          name:     r.name     ?? null,
          sector:   r.sector   ?? null,
          tier:     r.tier     ?? null,
          years:    r.years    ?? null,
          added_at: r.added_at,
          note:     r.note     ?? null,
        }))
      }
    } catch { /* 테이블 없으면 무시 */ }

    return NextResponse.json({ stocks, screening, customWatchlist })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
