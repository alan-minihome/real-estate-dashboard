import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

interface KrEtfRow {
  ticker: string
  name: string | null
  issuer: string | null
  us_equiv: string | null
  index_name: string | null
  div_yield: number | null
  expense_ratio: number | null
  aum_krw: number | null
  div_frequency: string | null
  hedged: number
  isa_eligible: number
  pension_eligible: number
  inception_year: number | null
  tracking_diff: number | null
  description: string | null
  screened_at: string | null
  last_price: number | null
}

export function GET() {
  try {
    const db = getDb()

    const etfs = db.prepare(`SELECT * FROM kr_etf_universe ORDER BY issuer, name`).all() as KrEtfRow[]

    // candidates 테이블에서 현재 후보함 목록 조회 (종목코드 문자열로 비교)
    const candidateTickers = new Set(
      (db.prepare(`SELECT ticker FROM candidates WHERE status != 'dropped'`).all() as { ticker: string }[])
        .map(r => r.ticker)
    )

    const result = etfs.map(e => ({
      ticker:           e.ticker,
      name:             e.name ?? e.ticker,
      issuer:           e.issuer ?? null,
      us_equiv:         e.us_equiv ?? null,
      index_name:       e.index_name ?? null,
      div_yield:        e.div_yield ?? null,
      expense_ratio:    e.expense_ratio ?? null,
      aum_krw:          e.aum_krw ?? null,
      div_frequency:    e.div_frequency ?? null,
      hedged:           e.hedged === 1,
      isa_eligible:     e.isa_eligible === 1,
      pension_eligible: e.pension_eligible === 1,
      inception_year:   e.inception_year ?? null,
      tracking_diff:    e.tracking_diff ?? null,
      description:      e.description ?? null,
      screened_at:      e.screened_at ?? null,
      last_price:       e.last_price ?? null,
      inWatchlist:      candidateTickers.has(e.ticker),
    }))

    return NextResponse.json({ etfs: result })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
