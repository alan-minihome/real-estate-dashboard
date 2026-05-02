import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export function GET() {
  try {
    const db = getDb()
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='investor_holdings'"
    ).get()
    if (!tableExists) return NextResponse.json([])

    const rows = db.prepare(
      'SELECT id, updated_at, data_json, memo FROM investor_holdings ORDER BY updated_at DESC LIMIT 20'
    ).all() as { id: number; updated_at: string; data_json: string; memo: string }[]

    return NextResponse.json(
      rows.map(r => ({
        id: r.id,
        updated_at: r.updated_at,
        memo: r.memo,
        ...JSON.parse(r.data_json),
      }))
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
