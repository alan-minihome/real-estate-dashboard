import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const PYTHON = '/home/alan/projects/dividend-dashboard/.venv/bin/python3'
const BASE   = '/home/alan/projects/dividend-dashboard'

export async function POST() {
  try {
    // 1. 기본 감시 종목 갱신
    await execAsync(
      `cd ${BASE} && ${PYTHON} -c "from modules.scheduler import run_now; run_now()"`,
      { timeout: 180_000 }
    )

    // 2. 커스텀 감시 목록 갱신 (custom_watchlist 테이블 → stock_data + screening_results)
    try {
      await execAsync(`${PYTHON} ${BASE}/fetch_custom.py`, { timeout: 120_000 })
    } catch {
      // 커스텀 종목이 없거나 실패해도 전체 갱신은 성공으로 처리
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
