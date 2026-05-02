import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET() {
  try {
    const { stdout } = await execAsync(
      '/home/alan/projects/dividend-dashboard/.venv/bin/python3 /home/alan/projects/dividend-dashboard/fetch_market_history.py',
      { timeout: 60_000 }
    )
    return NextResponse.json(JSON.parse(stdout.trim()))
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
