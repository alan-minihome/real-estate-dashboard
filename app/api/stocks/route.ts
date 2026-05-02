import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export function GET() {
  try {
    const db = getDb()

    const stocks = db.prepare(`
      SELECT s.* FROM stock_data s
      INNER JOIN (
        SELECT ticker, MAX(fetched_at) AS max_at FROM stock_data GROUP BY ticker
      ) t ON s.ticker = t.ticker AND s.fetched_at = t.max_at
    `).all()

    const screening = db.prepare(`
      SELECT sr.* FROM screening_results sr
      INNER JOIN (
        SELECT ticker, MAX(screened_at) AS max_at FROM screening_results GROUP BY ticker
      ) t ON sr.ticker = t.ticker AND sr.screened_at = t.max_at
    `).all()

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
