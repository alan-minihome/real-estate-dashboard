import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export function GET() {
  try {
    const db = getDb()
    const today = new Date().toISOString().slice(0, 10)
    const upcoming = db.prepare(
      'SELECT * FROM dividend_history WHERE ex_div_date >= ? ORDER BY ex_div_date LIMIT 30'
    ).all(today)
    return NextResponse.json(upcoming)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
