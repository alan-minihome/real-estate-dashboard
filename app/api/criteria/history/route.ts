import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

interface CriteriaRow { id: number; updated_at: string; criteria_json: string; active_keys: string|null; memo: string|null }

export function GET() {
  try {
    const db = getDb()
    const rows = db.prepare(
      'SELECT id, updated_at, criteria_json, active_keys, memo FROM criteria ORDER BY updated_at DESC LIMIT 50'
    ).all() as CriteriaRow[]

    const history = rows.map(r => ({
      id: r.id,
      updated_at: r.updated_at,
      criteria: JSON.parse(r.criteria_json),
      active_keys: r.active_keys ? JSON.parse(r.active_keys) : [],
      memo: r.memo || '',
    }))

    return NextResponse.json(history)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
