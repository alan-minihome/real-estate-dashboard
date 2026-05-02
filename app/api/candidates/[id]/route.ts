import { NextResponse } from 'next/server'
import { getWriteDb } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const db = getWriteDb()
    const fields: string[] = []
    const values: unknown[] = []
    if (body.target_shares !== undefined) { fields.push('target_shares=?'); values.push(body.target_shares) }
    if (body.memo !== undefined) { fields.push('memo=?'); values.push(body.memo) }
    if (body.status !== undefined) { fields.push('status=?'); values.push(body.status) }
    if (!fields.length) return NextResponse.json({ ok: true })
    values.push(id)
    db.prepare(`UPDATE candidates SET ${fields.join(',')} WHERE id=?`).run(...values)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getWriteDb()
    db.prepare(`UPDATE candidates SET status='dropped' WHERE id=?`).run(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
