import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { existsSync, readFileSync, openSync, writeFileSync } from 'fs'

const STATUS_FILE = '/tmp/dividend-universe-fetch.status.json'
const LOG_FILE    = '/tmp/dividend-universe-fetch.log'

interface Status {
  state: 'running' | 'done' | 'error' | 'idle'
  started_at?: string
  finished_at?: string
  pid?: number
  message?: string
}

function readStatus(): Status {
  if (!existsSync(STATUS_FILE)) return { state: 'idle' }
  try {
    return JSON.parse(readFileSync(STATUS_FILE, 'utf8')) as Status
  } catch {
    return { state: 'idle' }
  }
}

function writeStatus(status: Status) {
  writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2))
}

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}

// GET: 상태 조회
export function GET() {
  const status = readStatus()

  // running인데 프로세스 죽었으면 done으로 마감
  if (status.state === 'running' && status.pid && !isAlive(status.pid)) {
    status.state = 'done'
    status.finished_at = new Date().toISOString()
    writeStatus(status)
  }

  let logTail = ''
  if (existsSync(LOG_FILE)) {
    const log = readFileSync(LOG_FILE, 'utf8')
    logTail = log.split('\n').slice(-30).join('\n')
  }
  return NextResponse.json({ ...status, logTail })
}

// POST: 백그라운드 수집 시작
export function POST() {
  const current = readStatus()
  if (current.state === 'running' && current.pid && isAlive(current.pid)) {
    return NextResponse.json({
      ok: false,
      error: '이미 수집이 진행 중입니다.',
      status: current,
    }, { status: 409 })
  }

  try {
    writeFileSync(LOG_FILE, '')
    const out = openSync(LOG_FILE, 'a')
    const err = openSync(LOG_FILE, 'a')

    const child = spawn(
      '/home/alan/projects/dividend-dashboard/.venv/bin/python3',
      ['/home/alan/projects/dividend-dashboard/fetch_universe.py'],
      { detached: true, stdio: ['ignore', out, err] }
    )
    child.unref()

    const status: Status = {
      state: 'running',
      started_at: new Date().toISOString(),
      pid: child.pid,
      message: 'S&P 500 수집 시작 (5~10분 소요)',
    }
    writeStatus(status)
    return NextResponse.json({ ok: true, ...status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
