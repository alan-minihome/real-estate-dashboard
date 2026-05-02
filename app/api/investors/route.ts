import { NextResponse } from 'next/server'
import { getDb, getWriteDb } from '@/lib/db'
import { SUPER_INVESTORS, SUPER_INVESTOR_COMMON } from '@/lib/watchlist'

function initTable(db: ReturnType<typeof getWriteDb>) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS investor_holdings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      updated_at  TEXT NOT NULL,
      data_json   TEXT NOT NULL,
      memo        TEXT DEFAULT ''
    )
  `).run()
}

// 공통 보유 자동 계산 (2인 이상 공통)
function calcCommon(holdings: Record<string, string[]>, minCount = 2): string[] {
  const freq: Record<string, number> = {}
  for (const tickers of Object.values(holdings)) {
    for (const t of tickers) freq[t] = (freq[t] || 0) + 1
  }
  return Object.entries(freq).filter(([, n]) => n >= minCount).map(([t]) => t)
}

export function GET() {
  try {
    const db = getDb()
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='investor_holdings'"
    ).get()

    if (!tableExists) {
      // DB에 없으면 watchlist.ts 기본값 반환
      return NextResponse.json({
        holdings: SUPER_INVESTORS,
        common: SUPER_INVESTOR_COMMON,
        updated_at: null,
        memo: '',
        from_db: false,
      })
    }

    const row = db.prepare(
      'SELECT * FROM investor_holdings ORDER BY updated_at DESC LIMIT 1'
    ).get() as { id: number; updated_at: string; data_json: string; memo: string } | undefined

    if (!row) {
      return NextResponse.json({
        holdings: SUPER_INVESTORS,
        common: SUPER_INVESTOR_COMMON,
        updated_at: null,
        memo: '',
        from_db: false,
      })
    }

    const data = JSON.parse(row.data_json)
    return NextResponse.json({
      holdings: data.holdings,
      common: data.common,
      updated_at: row.updated_at,
      memo: row.memo,
      from_db: true,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      holdings: Record<string, string[]>
      memo?: string
    }
    const db = getWriteDb()
    initTable(db)

    const common = calcCommon(body.holdings)
    db.prepare(
      'INSERT INTO investor_holdings (updated_at, data_json, memo) VALUES (?, ?, ?)'
    ).run(
      new Date().toISOString(),
      JSON.stringify({ holdings: body.holdings, common }),
      body.memo || '',
    )
    return NextResponse.json({ ok: true, common })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
