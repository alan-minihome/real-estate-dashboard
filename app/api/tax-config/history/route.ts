import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export function GET() {
  try {
    const db = getDb()
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tax_config'"
    ).get()
    if (!tableExists) return NextResponse.json([])
    const rows = db.prepare(
      'SELECT id, config_json, updated_at FROM tax_config ORDER BY updated_at DESC LIMIT 24'
    ).all() as { id: number; config_json: string; updated_at: string }[]
    return NextResponse.json(
      rows.map(r => ({ id: r.id, updated_at: r.updated_at, ...JSON.parse(r.config_json) }))
    )
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
