import { NextResponse } from 'next/server'
import { getDb, getWriteDb } from '@/lib/db'

export function GET() {
  try {
    const db = getDb()
    const rows = db.prepare(`
      SELECT
        d.*,
        COUNT(r.id)                                    AS receipt_count,
        SUM(COALESCE(r.amount, d.amount))              AS total_received,
        MAX(r.actual_date)                             AS last_received
      FROM other_dividends d
      LEFT JOIN other_dividend_receipts r ON r.dividend_id = d.id
      GROUP BY d.id
      ORDER BY d.active DESC, d.created_at DESC
    `).all()
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      name, amount, currency, type,
      period_type, period_value,
      scheduled_day, start_date, end_date, memo, principal,
    } = body
    if (!name || !amount) return NextResponse.json({ error: 'name/amount required' }, { status: 400 })

    const db  = getWriteDb()
    const now = new Date().toISOString()
    const result = db.prepare(`
      INSERT INTO other_dividends
        (name, amount, currency, type, period_type, period_value,
         scheduled_day, start_date, end_date, memo, principal, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      name, amount,
      currency     || 'KRW',
      type         || 'recurring',
      period_type  ?? null,
      period_value ?? null,
      scheduled_day ?? null,
      start_date   ?? null,
      end_date     ?? null,
      memo         ?? null,
      principal    ?? null,
      now,
    )
    return NextResponse.json({ ok: true, id: result.lastInsertRowid })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
