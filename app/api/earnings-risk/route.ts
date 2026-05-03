import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

const PYTHON = '/home/alan/projects/dividend-dashboard/.venv/bin/python3'
const SCRIPT = path.join('/home/alan/projects/dividend-dashboard', 'fetch_earnings_risk.py')

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const raw = searchParams.get('tickers') || ''
  const tickers = raw.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)

  if (tickers.length === 0) return NextResponse.json({})

  return new Promise<Response>((resolve) => {
    const py = spawn(PYTHON, [SCRIPT, ...tickers])
    let out = ''
    let err = ''
    py.stdout.on('data', (d: Buffer) => { out += d.toString() })
    py.stderr.on('data', (d: Buffer) => { err += d.toString() })
    py.on('close', (code: number) => {
      if (code !== 0) {
        resolve(NextResponse.json({ error: err.slice(0, 300) }, { status: 500 }))
        return
      }
      try {
        resolve(NextResponse.json(JSON.parse(out)))
      } catch {
        resolve(NextResponse.json({ error: 'parse error' }, { status: 500 }))
      }
    })
  })
}
