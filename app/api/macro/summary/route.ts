import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

interface MacroRow { indicator: string; recorded_at: string; value: number }

function getLatest(rows: MacroRow[], n = 1): number[] {
  return rows.slice(0, n).map(r => r.value)
}

export function GET() {
  try {
    const db = getDb()

    const t10y2y = db.prepare(
      "SELECT * FROM macro_data WHERE indicator = 'T10Y2Y' ORDER BY recorded_at DESC LIMIT 5"
    ).all() as MacroRow[]

    const unrate = db.prepare(
      "SELECT * FROM macro_data WHERE indicator = 'UNRATE' ORDER BY recorded_at DESC LIMIT 5"
    ).all() as MacroRow[]

    const rsafs = db.prepare(
      "SELECT * FROM macro_data WHERE indicator = 'RSAFS' ORDER BY recorded_at DESC LIMIT 5"
    ).all() as MacroRow[]

    // DGS10: 최신 60개월 (5년) — 매수신호 ERP 계산용
    const dgs10Rows = db.prepare(
      "SELECT * FROM macro_data WHERE indicator = 'DGS10' ORDER BY recorded_at DESC LIMIT 60"
    ).all() as MacroRow[]
    const dgs10Latest = dgs10Rows.length > 0 ? dgs10Rows[0].value : null
    const dgs10_5y_avg = dgs10Rows.length > 0
      ? dgs10Rows.reduce((s, r) => s + r.value, 0) / dgs10Rows.length
      : null

    const signals: { id: string; label: string; status: 'ok' | 'warning' | 'danger'; value: string; detail: string }[] = []
    let riskScore = 0

    // ── 장단기 금리차 ─────────────────────────────────────────────
    if (t10y2y.length > 0) {
      const latest = t10y2y[0].value
      const status = latest < 0 ? 'danger' : latest < 0.5 ? 'warning' : 'ok'
      if (status === 'danger') riskScore += 1
      signals.push({
        id: 'yield_curve',
        label: '장단기 금리차 (10Y-2Y)',
        status,
        value: `${latest.toFixed(2)}%`,
        detail: latest < 0
          ? '역전 상태 — 경기침체 선행 신호'
          : latest < 0.5
          ? '정상화 진행 중 — 주시 필요'
          : '정상 범위',
      })
    }

    // ── 실업률 ────────────────────────────────────────────────────
    if (unrate.length >= 4) {
      const [cur, , , prev3] = getLatest(unrate, 4)
      const delta = cur - prev3
      const status = delta >= 0.5 ? 'danger' : delta >= 0.3 ? 'warning' : 'ok'
      if (status === 'danger') riskScore += 1
      signals.push({
        id: 'unemployment',
        label: '미국 실업률',
        status,
        value: `${cur.toFixed(1)}%`,
        detail: delta >= 0.3
          ? `3개월 전 대비 +${delta.toFixed(1)}%p 상승`
          : '안정적',
      })
    }

    // ── 소매판매 ──────────────────────────────────────────────────
    if (rsafs.length >= 3) {
      const [m0, m1, m2] = getLatest(rsafs, 3)
      const declining2 = m0 < m1 && m1 < m2
      const declining1 = m0 < m1
      const status = declining2 ? 'danger' : declining1 ? 'warning' : 'ok'
      if (status === 'danger') riskScore += 1
      const pct = ((m0 - m1) / m1 * 100).toFixed(1)
      signals.push({
        id: 'retail_sales',
        label: '소매판매',
        status,
        value: `$${(m0 / 1000).toFixed(0)}B`,
        detail: declining2
          ? `2개월 연속 감소 (전월比 ${pct}%)`
          : declining1
          ? `전월 대비 ${pct}% 감소`
          : '증가세 유지',
      })
    }

    // ── 종합 위험도 ───────────────────────────────────────────────
    const riskLevel: 'low' | 'moderate' | 'high' =
      riskScore === 0 ? 'low' : riskScore === 1 ? 'moderate' : 'high'

    const recommendations: Record<string, string> = {
      low: '거시환경 양호 — 정상 기준으로 종목 선별',
      moderate: '일부 신호 감지 — 경기소비재·고부채 종목 비중 점검 권장',
      high: '복수 경고 신호 — 방어주(필수소비재·헬스케어) 비중 확대 고려',
    }

    return NextResponse.json({
      risk_score: riskScore,
      risk_level: riskLevel,
      signals,
      recommendation: recommendations[riskLevel],
      updated_at: t10y2y[0]?.recorded_at ?? null,
      // DGS10 — 매수신호 ERP 계산용 (null이면 DGS10 미수집)
      dgs10: dgs10Latest,
      dgs10_5y_avg: dgs10_5y_avg !== null ? Math.round(dgs10_5y_avg * 100) / 100 : null,
      dgs10_updated_at: dgs10Rows[0]?.recorded_at ?? null,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
