import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export function GET() {
  try {
    const db = getDb()
    const row = db.prepare('SELECT MAX(synced_at) AS max_at FROM portfolio').get() as { max_at: string | null }
    if (!row?.max_at) return NextResponse.json([])
    const portfolio = db.prepare('SELECT * FROM portfolio WHERE synced_at = ?').all(row.max_at)
    return NextResponse.json(portfolio)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
