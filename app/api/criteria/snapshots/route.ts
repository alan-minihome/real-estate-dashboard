import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export function GET() {
  try {
    const db = getDb()

    // criteria_snapshots 테이블이 없으면 빈 배열 반환
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='criteria_snapshots'"
    ).get()
    if (!tableExists) return NextResponse.json([])

    // 최근 12개 criteria 저장 가져오기
    const saves = db.prepare(
      'SELECT id, updated_at, memo FROM criteria ORDER BY updated_at DESC LIMIT 12'
    ).all() as { id: number; updated_at: string; memo: string }[]

    if (saves.length === 0) return NextResponse.json([])

    // 각 save의 스냅샷 결과 조회
    const snapshots = saves.map(save => {
      const rows = db.prepare(
        'SELECT ticker, overall_pass, pass_count FROM criteria_snapshots WHERE criteria_id = ?'
      ).all(save.id) as { ticker: string; overall_pass: number; pass_count: number }[]

      const byTicker: Record<string, { overall_pass: number; pass_count: number }> = {}
      for (const r of rows) byTicker[r.ticker] = { overall_pass: r.overall_pass, pass_count: r.pass_count }

      return {
        id: save.id,
        updated_at: save.updated_at,
        memo: save.memo,
        results: byTicker,
      }
    })

    // 가장 오래된 것 먼저(시계열 순)
    return NextResponse.json(snapshots.reverse())
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
