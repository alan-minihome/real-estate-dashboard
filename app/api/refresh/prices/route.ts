import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const PYTHON = '/home/alan/projects/dividend-dashboard/.venv/bin/python3'
const BASE   = '/home/alan/projects/dividend-dashboard'

export async function POST() {
  try {
    await execAsync(
      `${PYTHON} ${BASE}/fetch_prices.py`,
      { timeout: 300_000 }
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
