import { NextResponse } from 'next/server'
import { getWriteDb } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params
    const id = Number(idStr)
    const body = await req.json()
    const { shares, avg_price, account_type, purchased_at, memo, name } = body

    const db = getWriteDb()
    db.prepare(`
      UPDATE holdings SET
        shares       = COALESCE(?, shares),
        avg_price    = ?,
        account_type = COALESCE(?, account_type),
        purchased_at = ?,
        memo         = ?,
        name         = COALESCE(?, name)
      WHERE id = ?
    `).run(
      shares ?? null,
      avg_price ?? null,
      account_type ?? null,
      purchased_at ?? null,
      memo ?? null,
      name ?? null,
      id,
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params
    const id = Number(idStr)
    const db = getWriteDb()
    db.prepare('DELETE FROM holdings WHERE id = ?').run(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
