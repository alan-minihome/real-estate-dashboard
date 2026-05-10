import { NextResponse } from 'next/server'
import { getWriteDb } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const {
      name, amount, currency, type,
      period_type, period_value,
      scheduled_day, start_date, end_date, memo, active, principal,
    } = body

    const db = getWriteDb()
    db.prepare(`
      UPDATE other_dividends SET
        name          = COALESCE(?, name),
        amount        = COALESCE(?, amount),
        currency      = COALESCE(?, currency),
        type          = COALESCE(?, type),
        period_type   = ?,
        period_value  = ?,
        scheduled_day = ?,
        start_date    = ?,
        end_date      = ?,
        memo          = ?,
        principal     = ?,
        active        = COALESCE(?, active)
      WHERE id = ?
    `).run(
      name ?? null, amount ?? null, currency ?? null, type ?? null,
      period_type ?? null, period_value ?? null, scheduled_day ?? null,
      start_date ?? null, end_date ?? null, memo ?? null,
      principal ?? null,
      active ?? null, Number(id),
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
    db.prepare('DELETE FROM other_dividends WHERE id = ?').run(Number(id))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
