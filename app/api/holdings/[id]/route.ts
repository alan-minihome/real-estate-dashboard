import { NextResponse } from 'next/server'
import { getWriteDb } from '@/lib/db'

// PATCH /api/holdings/[id] — 개별 매수 기록 수정
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params
    const id = Number(idStr)
    const body = await req.json()
    const { shares, price, account_type, traded_at, memo, name } = body

    const db = getWriteDb()
    db.prepare(`
      UPDATE trades SET
        shares       = COALESCE(?, shares),
        price        = COALESCE(?, price),
        account_type = COALESCE(?, account_type),
        traded_at    = COALESCE(?, traded_at),
        memo         = ?,
        name         = COALESCE(?, name)
      WHERE id = ?
    `).run(
      shares   ?? null,
      price    ?? null,
      account_type ?? null,
      traded_at ?? null,
      memo ?? null,
      name ?? null,
      id,
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// DELETE /api/holdings/[id] — 개별 매수 기록 삭제
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params
    const id = Number(idStr)
    const db = getWriteDb()
    db.prepare('DELETE FROM trades WHERE id = ?').run(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
