import { NextResponse } from 'next/server'
import { getDb, getWriteDb } from '@/lib/db'

interface EtfRow {
  ticker: string
  name: string | null
  category: string
  div_yield: number | null
  expense_ratio: number | null
  aum: number | null
  div_frequency: string | null
  inception_year: number | null
  description: string | null
  screened_at: string | null
}

// expense_ratio 정규화: DB에 혼재된 단위 통일 (> 1이면 ÷100)
function normalizeExpense(v: number | null): number | null {
  if (v === null || v === undefined) return null
  return v > 1 ? Math.round((v / 100) * 1000) / 1000 : v
}

export function GET() {
  try {
    const db = getDb()

    const etfs = db.prepare(`SELECT * FROM etf_universe ORDER BY category, ticker`).all() as EtfRow[]

    // candidates 테이블에서 현재 후보함 목록 조회
    const candidateTickers = new Set(
      (db.prepare(`SELECT ticker FROM candidates WHERE status != 'dropped'`).all() as { ticker: string }[])
        .map(r => r.ticker)
    )

    const result = etfs.map(e => ({
      ticker:        e.ticker,
      name:          e.name ?? e.ticker,
      category:      e.category,
      div_yield:     e.div_yield ?? null,
      expense_ratio: normalizeExpense(e.expense_ratio),
      aum:           e.aum ?? null,
      div_frequency: e.div_frequency ?? null,
      inception_year: e.inception_year ?? null,
      description:   e.description ?? null,
      screened_at:   e.screened_at ?? null,
      inWatchlist:   candidateTickers.has(e.ticker),
    }))

    return NextResponse.json({ etfs: result })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// ETF를 후보함에 추가
export async function POST(req: Request) {
  try {
    const { ticker, name, asset_type } = await req.json()
    if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

    const db = getWriteDb()
    db.prepare(`
      INSERT INTO candidates (ticker, name, added_at, status, asset_type)
      VALUES (?, ?, ?, 'watching', ?)
      ON CONFLICT(ticker) DO UPDATE SET status='watching', added_at=excluded.added_at
    `).run(ticker.toUpperCase(), name || ticker, new Date().toISOString(), asset_type || 'us_etf')

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
