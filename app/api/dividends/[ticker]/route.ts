import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  return params.then(({ ticker }) => {
    try {
      const db = getDb()
      const history = db.prepare(
        'SELECT * FROM dividend_history WHERE ticker = ? ORDER BY ex_div_date DESC LIMIT 20'
      ).all(ticker.toUpperCase())
      return NextResponse.json(history)
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  })
}
