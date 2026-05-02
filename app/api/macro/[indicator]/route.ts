import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export function GET(_req: Request, { params }: { params: Promise<{ indicator: string }> }) {
  return params.then(({ indicator }) => {
    try {
      const db = getDb()
      const rows = db.prepare(
        'SELECT * FROM macro_data WHERE indicator = ? ORDER BY recorded_at DESC LIMIT 60'
      ).all(indicator.toUpperCase())
      return NextResponse.json(rows)
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 })
    }
  })
}
