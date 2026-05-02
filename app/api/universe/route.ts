import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { WATCHLIST } from '@/lib/watchlist'
import { KNOWN_YEARS, TIER_MAP } from '@/lib/universe'

interface UniverseRow {
  ticker: string
  screened_at: string
  overall_pass: number | null
  buy_signal: number | null
  signal_reason: string | null
  checks_json: string | null
  name: string | null
  sector: string | null
  price: number | null
  div_yield: number | null
  div_yield_5y: number | null
  market_cap: number | null
  consecutive_years: number | null
}

interface StockRow {
  ticker: string
  price: number | null
  div_yield: number | null
  div_yield_5y: number | null
  payout_ratio: number | null
  div_growth_5y: number | null
  peg: number | null
  market_cap: number | null
  sector: string | null
  fetched_at: string
}

export function GET() {
  try {
    const db = getDb()
    const watchlistTickers = new Set(WATCHLIST.map(w => w.ticker))

    // universe_screening 최신 결과 (name, sector, price, div_yield 포함)
    const screenings = db.prepare(`
      SELECT u.* FROM universe_screening u
      INNER JOIN (
        SELECT ticker, MAX(screened_at) ma FROM universe_screening GROUP BY ticker
      ) latest ON u.ticker = latest.ticker AND u.screened_at = latest.ma
    `).all() as UniverseRow[]

    // stock_data 최신 (정밀 수치 보완용)
    const stocks = db.prepare(`
      SELECT s.* FROM stock_data s
      INNER JOIN (
        SELECT ticker, MAX(fetched_at) ma FROM stock_data GROUP BY ticker
      ) latest ON s.ticker = latest.ticker AND s.fetched_at = latest.ma
    `).all() as StockRow[]
    const stockMap = Object.fromEntries(stocks.map(s => [s.ticker, s]))

    const lastUpdated = screenings.reduce(
      (max, s) => (s.screened_at > max ? s.screened_at : max), ''
    )

    const result = screenings.map(u => {
      const s = stockMap[u.ticker]
      const tier = TIER_MAP[u.ticker] ?? null
      return {
        ticker:            u.ticker,
        name:              u.name ?? s?.ticker ?? u.ticker,
        sector:            u.sector ?? s?.sector ?? null,
        tier,
        consecutive_years: u.consecutive_years ?? KNOWN_YEARS[u.ticker] ?? null,
        inWatchlist:       watchlistTickers.has(u.ticker),
        price:             u.price ?? s?.price ?? null,
        div_yield:         u.div_yield ?? s?.div_yield ?? null,
        div_yield_5y:      u.div_yield_5y ?? s?.div_yield_5y ?? null,
        payout_ratio:      s?.payout_ratio ?? null,
        div_growth_5y:     s?.div_growth_5y ?? null,
        peg:               s?.peg ?? null,
        market_cap:        u.market_cap ?? s?.market_cap ?? null,
        overall_pass:      u.overall_pass ?? null,
        buy_signal:        u.buy_signal ?? null,
        signal_reason:     u.signal_reason ?? null,
        checks_json:       u.checks_json ?? null,
        screened_at:       u.screened_at,
      }
    })

    return NextResponse.json({ universe: result, last_updated: lastUpdated || null })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
