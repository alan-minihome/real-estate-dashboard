import { NextResponse } from 'next/server'
import { getDb, getWriteDb } from '@/lib/db'
import { WATCHLIST } from '@/lib/watchlist'
import { CRITERIA_CATALOG } from '@/lib/criteria'

export function GET() {
  try {
    const db = getDb()
    const row = db.prepare('SELECT criteria_json, active_keys, updated_at FROM criteria ORDER BY updated_at DESC LIMIT 1').get() as { criteria_json: string, active_keys: string, updated_at: string } | undefined
    if (!row) return NextResponse.json(null)
    return NextResponse.json({
      criteria: JSON.parse(row.criteria_json),
      active_keys: row.active_keys ? JSON.parse(row.active_keys) : [],
      updated_at: row.updated_at,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

function evaluateTicker(
  stock: Record<string, number | null>,
  criteria: Record<string, number>,
  activeKeys: string[]
): { passCount: number; details: Record<string, boolean | null>; overallPass: boolean } {
  const details: Record<string, boolean | null> = {}
  let passCount = 0
  let total = 0

  for (const c of CRITERIA_CATALOG) {
    if (!activeKeys.includes(c.key)) continue

    const colMap: Record<string, string> = {
      payout_ratio_max: 'payout_ratio',
      div_growth_5y_min: 'div_growth_5y',
      peg_max: 'peg',
      de_ratio_max: 'de_ratio',
      roe_min: 'roe',
      eps_growth_min: 'eps_growth',
      yield_vs_avg_min: '__yield_diff',
      fcf_yield_min: 'fcf_yield',
      div_yield_min: 'div_yield',
    }
    const col = colMap[c.key]
    if (!col) continue

    let val: number | null
    if (col === '__yield_diff') {
      const y = stock.div_yield
      const y5 = stock.div_yield_5y
      val = y != null && y5 != null ? y - y5 : null
    } else {
      val = stock[col] as number | null
    }

    if (val == null) {
      details[c.key] = null
      continue
    }

    const threshold = criteria[c.key]
    const pass = c.direction === 'max' ? val <= threshold : val >= threshold
    details[c.key] = pass
    total++
    if (pass) passCount++
  }

  return { passCount, details, overallPass: total > 0 && passCount === total }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const db = getWriteDb()

    // テーブル初期化
    db.prepare(`
      CREATE TABLE IF NOT EXISTS criteria_snapshots (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        criteria_id INTEGER NOT NULL,
        ticker      TEXT NOT NULL,
        overall_pass INTEGER,
        pass_count  INTEGER,
        details_json TEXT,
        snapped_at  TEXT NOT NULL
      )
    `).run()

    // 기준 저장
    const result = db.prepare(
      'INSERT INTO criteria (updated_at, criteria_json, active_keys, memo) VALUES (?, ?, ?, ?)'
    ).run(
      new Date().toISOString(),
      JSON.stringify(body.criteria),
      JSON.stringify(body.active_keys || []),
      body.memo || '',
    )
    const criteriaId = result.lastInsertRowid

    // 스냅샷: 현재 stock_data 기준으로 각 종목 평가
    const tickers = WATCHLIST.map(w => w.ticker)
    const snappedAt = new Date().toISOString()
    const insert = db.prepare(
      'INSERT INTO criteria_snapshots (criteria_id, ticker, overall_pass, pass_count, details_json, snapped_at) VALUES (?, ?, ?, ?, ?, ?)'
    )

    for (const ticker of tickers) {
      const stock = db.prepare(
        'SELECT * FROM stock_data WHERE ticker = ? ORDER BY fetched_at DESC LIMIT 1'
      ).get(ticker) as Record<string, number | null> | undefined

      if (!stock) continue

      const { passCount, details, overallPass } = evaluateTicker(stock, body.criteria, body.active_keys || [])
      insert.run(criteriaId, ticker, overallPass ? 1 : 0, passCount, JSON.stringify(details), snappedAt)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
