import { NextResponse } from 'next/server'
import { getDb, getWriteDb } from '@/lib/db'

const DEFAULT_TAX_CONFIG = {
  accounts: [
    {
      id: 'general',
      label: '일반 계좌',
      rate: 15.4,
      description: '미국 원천징수 15%(한미조세조약) + 국내 배당소득세 0.4%(지방세 포함). 개별 미국 주식 직접 매수 가능.',
      law_basis: '소득세법 제129조 제1항 제2호, 한미조세조약 제10조',
      source_label: '국세청',
      source_url: 'https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2326&cntntsId=7710',
    },
    {
      id: 'isa',
      label: 'ISA (중개형)',
      rate: 15.0,
      description: '2021년부터 개별 미국 주식 직접 매수 가능. 국내 배당소득세 면제되나 미국 원천징수 15%는 조세조약상 그대로 적용.',
      law_basis: '조세특례제한법 제91조의18, 한미조세조약 제10조',
      source_label: '금융위원회 · 국세청',
      source_url: 'https://www.fsc.go.kr/no010101/81043',
    },
    {
      id: 'custom',
      label: '직접 입력',
      rate: 0.0,
      description: '세율을 직접 입력합니다.',
      law_basis: '',
      source_label: '',
      source_url: '',
    },
  ],
  verified_at: '2026-05-01',
  note: '개별 미국 주식 배당금 기준 (일반 계좌·ISA 중개형). 연금저축·IRP는 개별 해외 주식 직접 매수 불가(국내상장 해외 ETF만 가능)하므로 제외.',
}

function initTable(db: ReturnType<typeof getWriteDb>) {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS tax_config (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      config_json TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    )
  `).run()
}

export function GET() {
  try {
    const db = getDb()
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='tax_config'"
    ).get()
    if (!tableExists) return NextResponse.json(DEFAULT_TAX_CONFIG)
    const row = db.prepare(
      'SELECT config_json FROM tax_config ORDER BY updated_at DESC LIMIT 1'
    ).get() as { config_json: string } | undefined
    if (!row) return NextResponse.json(DEFAULT_TAX_CONFIG)
    const saved = JSON.parse(row.config_json)
    // pension 항목은 개별 미국 주식 불가 — 저장된 설정에 있어도 필터
    if (saved.accounts) {
      saved.accounts = saved.accounts.filter((a: { id: string }) => a.id !== 'pension')
    }
    return NextResponse.json(saved)
  } catch {
    return NextResponse.json(DEFAULT_TAX_CONFIG)
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const db = getWriteDb()
    initTable(db)
    db.prepare(
      'INSERT INTO tax_config (config_json, updated_at) VALUES (?, ?)'
    ).run(JSON.stringify(body), new Date().toISOString())
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
