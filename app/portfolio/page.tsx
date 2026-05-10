'use client'
import { useEffect, useState, useMemo } from 'react'

const TAX_RATE = 15.4

const ACCOUNT_LABEL: Record<string, { label: string; color: string }> = {
  general: { label: '일반',    color: 'bg-slate-100 text-slate-600' },
  isa:     { label: 'ISA',     color: 'bg-emerald-100 text-emerald-700' },
  pension: { label: '연금저축', color: 'bg-violet-100 text-violet-700' },
}

const ASSET_LABEL: Record<string, string> = {
  stock:  '💰 배당주',
  us_etf: '🇺🇸 ETF',
  kr_etf: '🇰🇷 ETF',
}

interface Holding {
  id: number
  ticker: string
  name: string | null
  asset_type: string
  account_type: string
  shares: number
  avg_price: number | null
  purchased_at: string | null
  memo: string | null
  added_at: string
  current_price: number | null
  div_yield: number | null
  sector: string | null
  issuer: string | null
  eval_amount: number | null
  cost_basis: number | null
  profit_loss: number | null
  profit_loss_pct: number | null
  annual_gross: number | null
}

const ASSET_TYPES = [
  { value: 'stock',  label: '💰 배당주 (USD)' },
  { value: 'us_etf', label: '🇺🇸 미국 ETF (USD)' },
  { value: 'kr_etf', label: '🇰🇷 국내 ETF (KRW)' },
]
const ACCOUNT_TYPES = [
  { value: 'general', label: '일반 계좌' },
  { value: 'isa',     label: 'ISA' },
  { value: 'pension', label: '연금저축' },
]

function fmtKRW(v: number) {
  return `₩${Math.round(v).toLocaleString()}`
}
function fmtUSD(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtPrice(v: number, isKr: boolean) {
  return isKr ? fmtKRW(v) : fmtUSD(v)
}

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [usdkrw, setUsdkrw] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // 편집 상태
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ shares: 0, avg_price: '', account_type: 'general', purchased_at: '', memo: '' })

  // 추가 폼
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    ticker: '', name: '', asset_type: 'stock', account_type: 'general',
    shares: '', avg_price: '', purchased_at: '', memo: '',
  })
  const [adding, setAdding] = useState(false)
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle')
  const [addErrors, setAddErrors] = useState<Record<string, string>>({})

  // 티커 입력 후 포커스 이탈 시 자동 조회
  async function lookupTicker(ticker: string) {
    if (!ticker) return
    setLookupStatus('loading')
    try {
      const res = await fetch(`/api/lookup?ticker=${encodeURIComponent(ticker)}`)
      const data = await res.json()
      if (data.found) {
        setAddForm(f => ({
          ...f,
          name:       f.name || data.name || '',
          asset_type: data.asset_type || f.asset_type,
        }))
        setLookupStatus('found')
      } else {
        setLookupStatus('notfound')
      }
    } catch {
      setLookupStatus('notfound')
    }
  }

  function validateAddForm() {
    const errs: Record<string, string> = {}
    if (!addForm.ticker.trim())       errs.ticker       = '티커를 입력하세요'
    if (!addForm.name.trim())         errs.name         = '종목명을 입력하세요'
    if (!addForm.shares || Number(addForm.shares) <= 0) errs.shares = '수량을 입력하세요'
    if (!addForm.avg_price || Number(addForm.avg_price) <= 0) errs.avg_price = '평균 매수가를 입력하세요'
    if (!addForm.purchased_at)        errs.purchased_at = '매수일을 입력하세요'
    setAddErrors(errs)
    return Object.keys(errs).length === 0
  }

  // 필터
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [filterAsset,   setFilterAsset]   = useState<string>('all')

  async function load() {
    setLoading(true)
    const [hr, mr] = await Promise.all([
      fetch('/api/holdings').then(r => r.json()),
      fetch('/api/market').then(r => r.json()).catch(() => ({})),
    ])
    if (Array.isArray(hr)) setHoldings(hr)
    if (mr?.USDKRW?.price) setUsdkrw(mr.USDKRW.price)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startEdit(h: Holding) {
    setEditingId(h.id)
    setEditForm({
      shares:       h.shares,
      avg_price:    h.avg_price != null ? String(h.avg_price) : '',
      account_type: h.account_type,
      purchased_at: h.purchased_at || '',
      memo:         h.memo || '',
    })
  }

  async function saveEdit(id: number) {
    await fetch(`/api/holdings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shares:       Number(editForm.shares),
        avg_price:    editForm.avg_price ? Number(editForm.avg_price) : null,
        account_type: editForm.account_type,
        purchased_at: editForm.purchased_at || null,
        memo:         editForm.memo || null,
      }),
    })
    setEditingId(null)
    load()
  }

  async function remove(id: number) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/holdings/${id}`, { method: 'DELETE' })
    load()
  }

  async function addHolding() {
    if (!validateAddForm()) return
    setAdding(true)
    await fetch('/api/holdings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker:       addForm.ticker.toUpperCase(),
        name:         addForm.name || addForm.ticker.toUpperCase(),
        asset_type:   addForm.asset_type,
        account_type: addForm.account_type,
        shares:       Number(addForm.shares),
        avg_price:    Number(addForm.avg_price),
        purchased_at: addForm.purchased_at,
        memo:         addForm.memo || null,
      }),
    })
    setAdding(false)
    setShowAdd(false)
    setAddForm({ ticker: '', name: '', asset_type: 'stock', account_type: 'general', shares: '', avg_price: '', purchased_at: '', memo: '' })
    setAddErrors({})
    setLookupStatus('idle')
    load()
  }

  // 필터
  const filtered = useMemo(() => holdings.filter(h => {
    if (filterAccount !== 'all' && h.account_type !== filterAccount) return false
    if (filterAsset   !== 'all' && h.asset_type   !== filterAsset)   return false
    return true
  }), [holdings, filterAccount, filterAsset])

  // KPI 합산 (전체 기준)
  const kpi = useMemo(() => {
    let totalEvalUSD = 0, totalEvalKRW = 0
    let totalCostUSD = 0, totalCostKRW = 0
    let totalDivUSD = 0,  totalDivKRW = 0

    for (const h of holdings) {
      const isKr = h.asset_type === 'kr_etf'
      if (h.eval_amount != null) {
        if (isKr) totalEvalKRW += h.eval_amount
        else       totalEvalUSD += h.eval_amount
      }
      if (h.cost_basis != null) {
        if (isKr) totalCostKRW += h.cost_basis
        else       totalCostUSD += h.cost_basis
      }
      if (h.annual_gross != null) {
        if (isKr) totalDivKRW += h.annual_gross
        else       totalDivUSD += h.annual_gross
      }
    }

    // USD → KRW 통합 (환율 있으면)
    const rate = usdkrw ?? 1350
    const totalEval = totalEvalKRW + totalEvalUSD * rate
    const totalCost = totalCostKRW + totalCostUSD * rate
    const totalPL   = totalEval - totalCost
    const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : null
    const totalDiv  = totalDivKRW + totalDivUSD * rate
    const totalDivNet = totalDiv * (1 - TAX_RATE / 100)

    return { totalEval, totalCost, totalPL, totalPLPct, totalDiv, totalDivNet, totalEvalUSD, totalEvalKRW, totalDivUSD, totalDivKRW }
  }, [holdings, usdkrw])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center"><div className="text-2xl mb-2">📊</div><p className="text-sm">로딩 중…</p></div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">📊 포트폴리오</h1>
          <p className="text-sm text-[#64748B] mt-1">실제 보유 종목 · 수익률 · 배당 수령 현황</p>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="px-4 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          + 종목 추가
        </button>
      </div>

      {/* 추가 폼 */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-[#1A56DB]/30 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">새 종목 추가</h3>
          <div className="grid grid-cols-4 gap-3 mb-3">
            {/* 티커 */}
            <div>
              <label className="text-xs text-[#64748B] mb-1 block">티커 *</label>
              <div className="relative">
                <input
                  value={addForm.ticker}
                  onChange={e => {
                    setAddForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))
                    setLookupStatus('idle')
                    if (addErrors.ticker) setAddErrors(p => ({ ...p, ticker: '' }))
                  }}
                  onBlur={e => lookupTicker(e.target.value.trim())}
                  placeholder="AAPL / 458730"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none pr-7 ${
                    addErrors.ticker ? 'border-red-400 bg-red-50' : 'border-[#E2E8F0] focus:border-[#1A56DB]'
                  }`}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs">
                  {lookupStatus === 'loading' && <span className="text-slate-400 animate-pulse">…</span>}
                  {lookupStatus === 'found'   && <span className="text-emerald-500">✓</span>}
                  {lookupStatus === 'notfound'&& <span className="text-slate-400" title="DB에 없음 — 직접 입력">?</span>}
                </span>
              </div>
              {addErrors.ticker && <p className="text-[10px] text-red-500 mt-0.5">{addErrors.ticker}</p>}
            </div>

            {/* 종목명 */}
            <div>
              <label className="text-xs text-[#64748B] mb-1 block">
                종목명 *
                {lookupStatus === 'found' && <span className="ml-1 text-emerald-500 text-[10px]">자동 입력됨</span>}
              </label>
              <input
                value={addForm.name}
                onChange={e => {
                  setAddForm(f => ({ ...f, name: e.target.value }))
                  if (addErrors.name) setAddErrors(p => ({ ...p, name: '' }))
                }}
                placeholder="직접 입력"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
                  addErrors.name ? 'border-red-400 bg-red-50' : 'border-[#E2E8F0] focus:border-[#1A56DB]'
                }`}
              />
              {addErrors.name && <p className="text-[10px] text-red-500 mt-0.5">{addErrors.name}</p>}
            </div>

            {/* 종류 */}
            <div>
              <label className="text-xs text-[#64748B] mb-1 block">종류</label>
              <select value={addForm.asset_type} onChange={e => setAddForm(f => ({ ...f, asset_type: e.target.value }))}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A56DB] bg-white">
                {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* 계좌 */}
            <div>
              <label className="text-xs text-[#64748B] mb-1 block">계좌</label>
              <select value={addForm.account_type} onChange={e => setAddForm(f => ({ ...f, account_type: e.target.value }))}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A56DB] bg-white">
                {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            {/* 보유 수량 */}
            <div>
              <label className="text-xs text-[#64748B] mb-1 block">보유 수량 *</label>
              <input
                type="number" min="0"
                value={addForm.shares}
                onChange={e => {
                  setAddForm(f => ({ ...f, shares: e.target.value }))
                  if (addErrors.shares) setAddErrors(p => ({ ...p, shares: '' }))
                }}
                placeholder="0"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
                  addErrors.shares ? 'border-red-400 bg-red-50' : 'border-[#E2E8F0] focus:border-[#1A56DB]'
                }`}
              />
              {addErrors.shares && <p className="text-[10px] text-red-500 mt-0.5">{addErrors.shares}</p>}
            </div>

            {/* 평균 매수가 */}
            <div>
              <label className="text-xs text-[#64748B] mb-1 block">매입가 · 평균 매수가 ({addForm.asset_type === 'kr_etf' ? '₩' : '$'}) *</label>
              <input
                type="number" min="0"
                value={addForm.avg_price}
                onChange={e => {
                  setAddForm(f => ({ ...f, avg_price: e.target.value }))
                  if (addErrors.avg_price) setAddErrors(p => ({ ...p, avg_price: '' }))
                }}
                placeholder="0"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
                  addErrors.avg_price ? 'border-red-400 bg-red-50' : 'border-[#E2E8F0] focus:border-[#1A56DB]'
                }`}
              />
              {addErrors.avg_price && <p className="text-[10px] text-red-500 mt-0.5">{addErrors.avg_price}</p>}
            </div>

            {/* 최초 매수일 */}
            <div>
              <label className="text-xs text-[#64748B] mb-1 block">최초 매수일 *</label>
              <input
                type="date"
                value={addForm.purchased_at}
                onChange={e => {
                  setAddForm(f => ({ ...f, purchased_at: e.target.value }))
                  if (addErrors.purchased_at) setAddErrors(p => ({ ...p, purchased_at: '' }))
                }}
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none ${
                  addErrors.purchased_at ? 'border-red-400 bg-red-50' : 'border-[#E2E8F0] focus:border-[#1A56DB]'
                }`}
              />
              {addErrors.purchased_at && <p className="text-[10px] text-red-500 mt-0.5">{addErrors.purchased_at}</p>}
            </div>

            {/* 메모 (선택) */}
            <div>
              <label className="text-xs text-[#64748B] mb-1 block">메모 <span className="text-slate-400">(선택)</span></label>
              <input value={addForm.memo} onChange={e => setAddForm(f => ({ ...f, memo: e.target.value }))}
                placeholder="계좌번호, 메모 등"
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1A56DB]" />
            </div>
          </div>

          {/* 필수 항목 안내 */}
          {Object.keys(addErrors).length > 0 && (
            <p className="text-xs text-red-500 mb-3">* 표시 항목을 모두 입력해주세요</p>
          )}

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowAdd(false); setAddErrors({}); setLookupStatus('idle') }}
              className="px-4 py-2 text-sm border border-[#E2E8F0] rounded-lg hover:bg-slate-50">취소</button>
            <button onClick={addHolding} disabled={adding}
              className="px-4 py-2 text-sm bg-[#1A56DB] text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {adding ? '추가 중…' : '추가'}
            </button>
          </div>
        </div>
      )}

      {/* KPI 카드 */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#64748B] mb-1">총 평가금액</p>
            <p className="text-xl font-bold text-[#0F172A]">{fmtKRW(kpi.totalEval)}</p>
            {usdkrw && kpi.totalEvalUSD > 0 && (
              <p className="text-[11px] text-[#94A3B8] mt-0.5">{fmtUSD(kpi.totalEvalUSD)} + {fmtKRW(kpi.totalEvalKRW)}</p>
            )}
          </div>
          <div className={`rounded-xl border p-4 ${kpi.totalPL >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs text-[#64748B] mb-1">총 손익</p>
            <p className={`text-xl font-bold ${kpi.totalPL >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {kpi.totalPL >= 0 ? '+' : ''}{fmtKRW(kpi.totalPL)}
            </p>
            {kpi.totalPLPct != null && (
              <p className={`text-xs mt-0.5 font-medium ${kpi.totalPL >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {kpi.totalPLPct >= 0 ? '+' : ''}{kpi.totalPLPct.toFixed(2)}%
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-xs text-[#64748B] mb-1">연간 배당 (세전)</p>
            <p className="text-xl font-bold text-[#0F172A]">{fmtKRW(kpi.totalDiv)}</p>
            {usdkrw && kpi.totalDivUSD > 0 && (
              <p className="text-[11px] text-[#94A3B8] mt-0.5">{fmtUSD(kpi.totalDivUSD)} + {fmtKRW(kpi.totalDivKRW)}</p>
            )}
          </div>
          <div className="bg-blue-50 rounded-xl border border-[#1A56DB] p-4">
            <p className="text-xs text-[#64748B] mb-1">연간 배당 <span className="font-semibold text-[#1A56DB]">세후</span> ({TAX_RATE}%)</p>
            <p className="text-xl font-bold text-[#1A56DB]">{fmtKRW(kpi.totalDivNet)}</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">월평균 {fmtKRW(kpi.totalDivNet / 12)}</p>
          </div>
        </div>
      )}

      {/* 필터 */}
      {holdings.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#64748B]">계좌</span>
          {['all', 'general', 'isa', 'pension'].map(v => (
            <button key={v} onClick={() => setFilterAccount(v)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                filterAccount === v ? 'bg-[#1A56DB] text-white border-[#1A56DB]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-slate-50'
              }`}>
              {v === 'all' ? '전체' : ACCOUNT_LABEL[v]?.label}
            </button>
          ))}
          <span className="text-xs text-[#64748B] ml-4">종류</span>
          {['all', 'stock', 'us_etf', 'kr_etf'].map(v => (
            <button key={v} onClick={() => setFilterAsset(v)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                filterAsset === v ? 'bg-[#1A56DB] text-white border-[#1A56DB]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-slate-50'
              }`}>
              {v === 'all' ? '전체' : ASSET_LABEL[v]}
            </button>
          ))}
        </div>
      )}

      {/* 보유 종목 테이블 */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-16 text-center">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-[#64748B] font-medium">
            {holdings.length === 0 ? '보유 종목이 없습니다' : '해당 필터에 종목이 없습니다'}
          </p>
          {holdings.length === 0 && (
            <p className="text-sm text-[#94A3B8] mt-2">+ 종목 추가 버튼으로 실제 보유 종목을 입력하세요</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E2E8F0] bg-slate-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#0F172A]">보유 종목 ({filtered.length})</p>
            {usdkrw && <p className="text-xs text-[#94A3B8]">환율 ₩{usdkrw.toLocaleString()} · 세율 {TAX_RATE}%</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/50 border-b border-[#E2E8F0] text-xs">
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">티커</th>
                  <th className="text-left px-3 py-3 font-medium text-[#64748B]">종목명</th>
                  <th className="text-center px-3 py-3 font-medium text-[#64748B]">종류</th>
                  <th className="text-center px-3 py-3 font-medium text-[#64748B]">계좌</th>
                  <th className="text-right px-3 py-3 font-medium text-[#64748B]">수량</th>
                  <th className="text-right px-3 py-3 font-medium text-[#64748B]">매입가</th>
                  <th className="text-right px-3 py-3 font-medium text-[#64748B]">현재가</th>
                  <th className="text-right px-3 py-3 font-medium text-[#64748B]">평가금액</th>
                  <th className="text-right px-3 py-3 font-medium text-[#64748B]">손익</th>
                  <th className="text-right px-3 py-3 font-medium text-[#64748B]">배당률</th>
                  <th className="text-right px-3 py-3 font-medium text-[#64748B]">연배당(세후)</th>
                  <th className="text-center px-3 py-3 font-medium text-[#64748B]">액션</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(h => {
                  const isKr  = h.asset_type === 'kr_etf'
                  const isEdit = editingId === h.id
                  const annualNet = h.annual_gross != null ? h.annual_gross * (1 - TAX_RATE / 100) : null

                  return (
                    <tr key={h.id} className={`border-b border-[#E2E8F0] last:border-0 transition-colors ${
                      h.profit_loss != null && h.profit_loss > 0 ? 'hover:bg-emerald-50/20' : 'hover:bg-slate-50/40'
                    }`}>
                      {/* 티커 */}
                      <td className="px-4 py-3 font-bold text-[#1A56DB] text-xs whitespace-nowrap">{h.ticker}</td>

                      {/* 종목명 */}
                      <td className="px-3 py-3 text-xs text-[#0F172A] max-w-[160px]">
                        <p className="truncate" title={h.name ?? ''}>{h.name ?? h.ticker}</p>
                        {h.purchased_at && !isEdit && (
                          <p className="text-[10px] text-[#94A3B8] mt-0.5">{h.purchased_at} 매수</p>
                        )}
                      </td>

                      {/* 종류 */}
                      <td className="px-3 py-3 text-center">
                        <span className="text-[10px] text-[#64748B]">{ASSET_LABEL[h.asset_type] ?? h.asset_type}</span>
                      </td>

                      {/* 계좌 */}
                      <td className="px-3 py-3 text-center">
                        {isEdit ? (
                          <select value={editForm.account_type} onChange={e => setEditForm(f => ({ ...f, account_type: e.target.value }))}
                            className="border border-[#E2E8F0] rounded px-1 py-0.5 text-xs bg-white focus:outline-none focus:border-[#1A56DB]">
                            {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        ) : (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ACCOUNT_LABEL[h.account_type]?.color}`}>
                            {ACCOUNT_LABEL[h.account_type]?.label ?? h.account_type}
                          </span>
                        )}
                      </td>

                      {/* 수량 */}
                      <td className="px-3 py-3 text-right tabular text-xs">
                        {isEdit ? (
                          <input type="number" min="0" value={editForm.shares}
                            onChange={e => setEditForm(f => ({ ...f, shares: Number(e.target.value) }))}
                            className="w-16 text-right border border-[#1A56DB] rounded px-1 py-0.5 text-xs focus:outline-none" />
                        ) : (
                          <span className="font-medium">{h.shares}주</span>
                        )}
                      </td>

                      {/* 평균매수가 */}
                      <td className="px-3 py-3 text-right tabular text-xs">
                        {isEdit ? (
                          <input type="number" min="0" value={editForm.avg_price}
                            onChange={e => setEditForm(f => ({ ...f, avg_price: e.target.value }))}
                            placeholder={isKr ? '₩' : '$'}
                            className="w-24 text-right border border-[#1A56DB] rounded px-1 py-0.5 text-xs focus:outline-none" />
                        ) : h.avg_price != null ? (
                          <span className="text-[#64748B]">{fmtPrice(h.avg_price, isKr)}</span>
                        ) : (
                          <span className="text-slate-300">미입력</span>
                        )}
                      </td>

                      {/* 현재가 */}
                      <td className="px-3 py-3 text-right tabular text-xs">
                        {h.current_price != null ? (
                          <span className="font-medium text-[#0F172A]">{fmtPrice(h.current_price, isKr)}</span>
                        ) : <span className="text-slate-300">–</span>}
                      </td>

                      {/* 평가금액 */}
                      <td className="px-3 py-3 text-right tabular text-xs">
                        {h.eval_amount != null ? (
                          <div>
                            <p className="font-medium text-[#0F172A]">{fmtPrice(h.eval_amount, isKr)}</p>
                            {!isKr && usdkrw && (
                              <p className="text-[10px] text-[#94A3B8]">{fmtKRW(h.eval_amount * usdkrw)}</p>
                            )}
                          </div>
                        ) : <span className="text-slate-300">–</span>}
                      </td>

                      {/* 손익 */}
                      <td className="px-3 py-3 text-right tabular text-xs">
                        {h.profit_loss != null ? (
                          <div>
                            <p className={`font-semibold ${h.profit_loss >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {h.profit_loss >= 0 ? '+' : ''}{fmtPrice(h.profit_loss, isKr)}
                            </p>
                            {h.profit_loss_pct != null && (
                              <p className={`text-[10px] ${h.profit_loss_pct >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                {h.profit_loss_pct >= 0 ? '+' : ''}{h.profit_loss_pct.toFixed(2)}%
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-[10px]">매수가 필요</span>
                        )}
                      </td>

                      {/* 배당률 */}
                      <td className="px-3 py-3 text-right tabular text-xs">
                        {h.div_yield != null ? (
                          <span className="text-emerald-600 font-medium">{h.div_yield.toFixed(2)}%</span>
                        ) : <span className="text-slate-300">–</span>}
                      </td>

                      {/* 연배당 세후 */}
                      <td className="px-3 py-3 text-right tabular text-xs">
                        {annualNet != null && annualNet > 0 ? (
                          <div>
                            <p className="font-medium text-[#1A56DB]">{fmtPrice(annualNet, isKr)}</p>
                            <p className="text-[10px] text-[#94A3B8]">월 {fmtPrice(annualNet / 12, isKr)}</p>
                          </div>
                        ) : <span className="text-slate-300">–</span>}
                      </td>

                      {/* 액션 */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 justify-center">
                          {isEdit ? (
                            <>
                              <button onClick={() => saveEdit(h.id)}
                                className="text-xs px-2 py-1 bg-[#1A56DB] text-white rounded hover:bg-blue-700">저장</button>
                              <button onClick={() => setEditingId(null)}
                                className="text-xs px-2 py-1 border border-[#E2E8F0] rounded hover:bg-slate-50">취소</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(h)}
                                className="text-xs px-2 py-1 border border-[#E2E8F0] rounded hover:bg-slate-50 text-[#64748B]">✏️</button>
                              <button onClick={() => remove(h.id)}
                                className="text-xs px-2 py-1 border border-red-200 text-red-400 rounded hover:bg-red-50">✕</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* 합계 행 */}
              {filtered.length > 1 && (() => {
                const subEvalUSD = filtered.filter(h => h.asset_type !== 'kr_etf').reduce((s, h) => s + (h.eval_amount ?? 0), 0)
                const subEvalKRW = filtered.filter(h => h.asset_type === 'kr_etf').reduce((s, h) => s + (h.eval_amount ?? 0), 0)
                const subDivNetUSD = filtered.filter(h => h.asset_type !== 'kr_etf').reduce((s, h) => s + (h.annual_gross ?? 0) * (1 - TAX_RATE / 100), 0)
                const subDivNetKRW = filtered.filter(h => h.asset_type === 'kr_etf').reduce((s, h) => s + (h.annual_gross ?? 0) * (1 - TAX_RATE / 100), 0)
                const rate = usdkrw ?? 1350
                const subEval = subEvalKRW + subEvalUSD * rate
                const subDivNet = subDivNetKRW + subDivNetUSD * rate
                return (
                  <tfoot>
                    <tr className="bg-blue-50/60 border-t-2 border-[#1A56DB] font-semibold text-sm">
                      <td colSpan={7} className="px-4 py-3 text-[#0F172A]">
                        합계
                        <span className="ml-1.5 text-xs font-normal text-[#64748B]">({filtered.length}종목)</span>
                      </td>
                      <td className="px-3 py-3 text-right tabular text-xs text-[#0F172A]">
                        {fmtKRW(subEval)}
                      </td>
                      <td className="px-3 py-3" />
                      <td className="px-3 py-3" />
                      <td className="px-3 py-3 text-right tabular text-xs text-[#1A56DB]">
                        {fmtKRW(subDivNet)}
                        <p className="text-[10px] font-normal text-[#64748B]">월 {fmtKRW(subDivNet / 12)}</p>
                      </td>
                      <td className="px-3 py-3" />
                    </tr>
                  </tfoot>
                )
              })()}
            </table>
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 leading-relaxed">
        ※ 현재가·배당률은 최근 수집 기준이며 실시간 시세가 아닙니다. 손익은 평균매수가 입력 시 자동 계산됩니다.<br />
        ※ 원화 환산은 참고용이며 실제 환전 손익은 반영되지 않습니다. 세율은 일반계좌 15.4% 기준입니다.
      </p>
    </div>
  )
}
