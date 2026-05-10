import { NextResponse } from 'next/server'
import { getWriteDb } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { expected_date, actual_date, amount, memo } = body

    const db = getWriteDb()
    db.prepare(`
      UPDATE other_dividend_receipts SET
        expected_date = ?,
        actual_date   = ?,
        amount        = ?,
        memo          = ?
      WHERE id = ?
    `).run(
      expected_date ?? null,
      actual_date   ?? null,
      amount        ?? null,
      memo          ?? null,
      Number(id),
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getWriteDb()
    db.prepare('DELETE FROM other_dividend_receipts WHERE id = ?').run(Number(id))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
