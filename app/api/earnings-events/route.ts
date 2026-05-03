import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const raw = searchParams.get('tickers') || ''
    const tickers = raw.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)

    const db = getDb()

    // earnings_events 테이블 없으면 빈 배열 반환
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='earnings_events'"
    ).get()
    if (!tableExists) return NextResponse.json([])

    let rows
    if (tickers.length > 0) {
      const placeholders = tickers.map(() => '?').join(',')
      rows = db.prepare(
        `SELECT * FROM earnings_events
         WHERE ticker IN (${placeholders})
         ORDER BY reported_date DESC, fetched_at DESC`
      ).all(...tickers)
    } else {
      rows = db.prepare(
        `SELECT * FROM earnings_events ORDER BY reported_date DESC, fetched_at DESC LIMIT 50`
      ).all()
    }

    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
