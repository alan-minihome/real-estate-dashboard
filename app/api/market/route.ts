import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET() {
  try {
    const { stdout } = await execAsync(
      '/home/alan/projects/dividend-dashboard/.venv/bin/python3 /home/alan/projects/dividend-dashboard/fetch_market.py',
      { timeout: 30_000 }
    )
    const data = JSON.parse(stdout.trim())
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
