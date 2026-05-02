import { NextResponse } from 'next/server'
import { getDb, getWriteDb } from '@/lib/db'

function initTable(db: ReturnType<typeof getWriteDb>) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS custom_watchlist (
      ticker   TEXT PRIMARY KEY,
      name     TEXT,
      sector   TEXT,
      tier     TEXT,
      years    INTEGER,
      added_at TEXT NOT NULL,
      note     TEXT DEFAULT ''
    )
  `).run()
}

export function GET() {
  try {
    const db = getDb()
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='custom_watchlist'"
    ).get()
    if (!tableExists) return NextResponse.json([])
    return NextResponse.json(
      db.prepare('SELECT * FROM custom_watchlist ORDER BY added_at DESC').all()
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      items: { ticker: string; name: string; sector: string | null; tier: string; years: number }[]
    }
    const db = getWriteDb()
    initTable(db)
    const now = new Date().toISOString()
    const insert = db.prepare(
      'INSERT OR REPLACE INTO custom_watchlist (ticker, name, sector, tier, years, added_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const item of body.items) {
      insert.run(item.ticker, item.name, item.sector ?? '', item.tier, item.years, now)
    }
    return NextResponse.json({ ok: true, added: body.items.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { ticker } = await req.json() as { ticker: string }
    const db = getWriteDb()
    initTable(db)
    db.prepare('DELETE FROM custom_watchlist WHERE ticker = ?').run(ticker)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
