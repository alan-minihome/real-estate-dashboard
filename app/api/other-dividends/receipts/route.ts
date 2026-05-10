import { NextResponse } from 'next/server'
import { getDb, getWriteDb } from '@/lib/db'

export function GET() {
  try {
    const db = getDb()
    const rows = db.prepare(`
      SELECT
        r.*,
        d.name        AS dividend_name,
        d.currency    AS currency,
        COALESCE(r.amount, d.amount) AS actual_amount,
        d.amount      AS base_amount,
        CASE
          WHEN r.expected_date IS NOT NULL AND r.actual_date IS NOT NULL
          THEN CAST(julianday(r.actual_date) - julianday(r.expected_date) AS INTEGER)
          ELSE NULL
        END AS day_diff
      FROM other_dividend_receipts r
      JOIN other_dividends d ON d.id = r.dividend_id
      ORDER BY COALESCE(r.actual_date, r.expected_date) DESC
    `).all()
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { dividend_id, expected_date, actual_date, amount, memo } = body
    if (!dividend_id) return NextResponse.json({ error: 'dividend_id required' }, { status: 400 })

    const db  = getWriteDb()
    const now = new Date().toISOString()
    const result = db.prepare(`
      INSERT INTO other_dividend_receipts
        (dividend_id, expected_date, actual_date, amount, memo, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      dividend_id,
      expected_date ?? null,
      actual_date   ?? null,
      amount        ?? null,
      memo          ?? null,
      now,
    )
    return NextResponse.json({ ok: true, id: result.lastInsertRowid })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
