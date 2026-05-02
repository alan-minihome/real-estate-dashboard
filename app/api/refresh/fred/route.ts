import { NextResponse } from 'next/server'
import { exec } from 'child_process'

export function POST() {
  return new Promise<NextResponse>((resolve) => {
    exec(
      '/home/alan/projects/dividend-dashboard/.venv/bin/python3 /home/alan/projects/dividend-dashboard/refresh_fred.sh 2>&1 || ' +
      'bash /home/alan/projects/dividend-dashboard/refresh_fred.sh',
      { timeout: 120_000 },
      (err, stdout, stderr) => {
        if (err) resolve(NextResponse.json({ ok: false, error: stderr || String(err) }, { status: 500 }))
        else resolve(NextResponse.json({ ok: true, stdout }))
      }
    )
  })
}
