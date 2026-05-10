'use client'
import { useEffect, useState, useMemo } from 'react'

// ── 타입 ──────────────────────────────────────────────────────────────
interface Dividend {
  id: number
  name: string
  amount: number
  currency: string
  type: string           // 'recurring' | 'short_term'
  period_type: string | null   // 'daily' | 'monthly'
  period_value: number | null
  scheduled_day: number | null
  start_date: string | null
  end_date: string | null
  memo: string | null
  principal: number | null
  active: number
  receipt_count: number
  total_received: number | null
  last_received: string | null
}

interface Receipt {
  id: number
  dividend_id: number
  dividend_name: string
  currency: string
  expected_date: string | null
  actual_date: string | null
  actual_amount: number
  base_amount: number
  day_diff: number | null
  memo: string | null
}

// ── 상수 ──────────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  recurring:  '계속',
  short_term: '단기',
}
const PERIOD_LABEL: Record<string, string> = {
  daily:   '일',
  monthly: '월',
}
const CURRENCY_LABEL: Record<string, string> = { KRW: '₩', USD: '$' }

function fmt(amount: number, currency: string) {
  const sym = CURRENCY_LABEL[currency] ?? currency
  if (currency === 'KRW') return `${sym}${Math.round(amount).toLocaleString()}`
  return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ym(dateStr: string) { return dateStr.slice(0, 7) } // 'YYYY-MM'
function today() { return new Date().toISOString().slice(0, 10) }
function thisYM() { return today().slice(0, 7) }
function thisYear() { return today().slice(0, 4) }

// ── 메인 ──────────────────────────────────────────────────────────────
export default function OtherDividendsPage() {
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [receipts,  setReceipts]  = useState<Receipt[]>([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<'items' | 'history' | 'monthly' | 'yearly'>('items')

  // 배당 항목 추가 폼
  const [showAddDiv, setShowAddDiv] = useState(false)
  const [divForm, setDivForm] = useState({
    name: '', amount: '', currency: 'KRW', type: 'recurring',
    period_type: 'monthly', period_value: '',
    scheduled_day: '', start_date: '', end_date: '', memo: '', principal: '',
  })
  const [addingDiv, setAddingDiv] = useState(false)
  const [editDivId, setEditDivId] = useState<number | null>(null)
  const [editDivForm, setEditDivForm] = useState({ ...divForm })

  // 수령 이력 추가 폼
  const [showAddRec, setShowAddRec] = useState(false)
  const [recForm, setRecForm] = useState({
    dividend_id: '', expected_date: '', actual_date: '', amount: '', memo: '',
  })
  const [addingRec, setAddingRec] = useState(false)
  const [editRecId, setEditRecId] = useState<number | null>(null)
  const [editRecForm, setEditRecForm] = useState({ ...recForm })

  // 빠른 수령 입력 (항목 탭 인라인)
  const [quickRecDivId, setQuickRecDivId] = useState<number | null>(null)
  const [quickRecForm, setQuickRecForm] = useState({ expected_date: '', actual_date: '', amount: '', memo: '' })
  const [savingQuick, setSavingQuick] = useState(false)

  // 항목 탭 필터 & 정렬
  const [itemFilter, setItemFilter] = useState<'active' | 'ended' | 'all'>('active')
  const [typeFilter, setTypeFilter] = useState<'all' | 'recurring' | 'short_term'>('all')
  type SortKey = 'name' | 'amount' | 'principal' | 'scheduled_day' | 'total_received' | 'yield'
  const [sortKey,  setSortKey]  = useState<SortKey | null>(null)
  const [sortDesc, setSortDesc] = useState(true)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDesc(d => !d)
    else { setSortKey(key); setSortDesc(true) }
  }

  // ── 로드 ────────────────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    const [dRes, rRes] = await Promise.all([
      fetch('/api/other-dividends').then(r => r.json()),
      fetch('/api/other-dividends/receipts').then(r => r.json()),
    ])
    if (Array.isArray(dRes)) setDividends(dRes)
    if (Array.isArray(rRes)) setReceipts(rRes)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // 이번달 수령 여부: dividend_id별 이번달 수령 record 찾기
  function thisMonthReceipt(dividendId: number): Receipt | undefined {
    const ym = thisYM()
    return receipts.find(r =>
      r.dividend_id === dividendId &&
      ((r.actual_date ?? '').startsWith(ym) || (r.expected_date ?? '').startsWith(ym))
    )
  }

  // 빠른 수령 폼 열기 (예상일 자동 계산)
  function openQuickRec(d: Dividend) {
    const curYM = thisYM()
    const expectedDate = d.scheduled_day
      ? `${curYM}-${String(d.scheduled_day).padStart(2, '0')}`
      : ''
    setQuickRecDivId(d.id)
    setQuickRecForm({
      expected_date: expectedDate,
      actual_date:   today(),
      amount:        '',
      memo:          '',
    })
  }

  async function saveQuickRec(d: Dividend) {
    setSavingQuick(true)
    await fetch('/api/other-dividends/receipts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dividend_id:   d.id,
        expected_date: quickRecForm.expected_date || null,
        actual_date:   quickRecForm.actual_date   || null,
        amount:        quickRecForm.amount ? Number(quickRecForm.amount) : null,
        memo:          quickRecForm.memo   || null,
      }),
    })
    setSavingQuick(false)
    setQuickRecDivId(null)
    load()
  }

  // ── 배당 항목 CRUD ──────────────────────────────────────────────────
  async function addDiv() {
    if (!divForm.name || !divForm.amount) return
    setAddingDiv(true)
    await fetch('/api/other-dividends', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:          divForm.name,
        amount:        Number(divForm.amount),
        currency:      divForm.currency,
        type:          divForm.type,
        period_type:   divForm.type === 'short_term' ? divForm.period_type : null,
        period_value:  divForm.type === 'short_term' && divForm.period_value ? Number(divForm.period_value) : null,
        scheduled_day: divForm.scheduled_day ? Number(divForm.scheduled_day) : null,
        start_date:    divForm.start_date || null,
        end_date:      divForm.type === 'short_term' ? (divForm.end_date || null) : null,
        memo:          divForm.memo || null,
        principal:     divForm.principal ? Number(divForm.principal) : null,
      }),
    })
    setAddingDiv(false)
    setShowAddDiv(false)
    setDivForm({ name: '', amount: '', currency: 'KRW', type: 'recurring', period_type: 'monthly', period_value: '', scheduled_day: '', start_date: '', end_date: '', memo: '', principal: '' })
    load()
  }

  function startEditDiv(d: Dividend) {
    setEditDivId(d.id)
    setEditDivForm({
      name: d.name, amount: String(d.amount), currency: d.currency,
      type: d.type, period_type: d.period_type ?? 'monthly',
      period_value: d.period_value != null ? String(d.period_value) : '',
      scheduled_day: d.scheduled_day != null ? String(d.scheduled_day) : '',
      start_date: d.start_date ?? '', end_date: d.end_date ?? '', memo: d.memo ?? '',
      principal: d.principal != null ? String(d.principal) : '',
    })
  }

  async function saveEditDiv(id: number) {
    await fetch(`/api/other-dividends/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:          editDivForm.name,
        amount:        Number(editDivForm.amount),
        currency:      editDivForm.currency,
        type:          editDivForm.type,
        period_type:   editDivForm.type === 'short_term' ? editDivForm.period_type : null,
        period_value:  editDivForm.type === 'short_term' && editDivForm.period_value ? Number(editDivForm.period_value) : null,
        scheduled_day: editDivForm.scheduled_day ? Number(editDivForm.scheduled_day) : null,
        start_date:    editDivForm.start_date || null,
        end_date:      editDivForm.type === 'short_term' ? (editDivForm.end_date || null) : null,
        memo:          editDivForm.memo || null,
        principal:     editDivForm.principal ? Number(editDivForm.principal) : null,
      }),
    })
    setEditDivId(null)
    load()
  }

  async function toggleActive(d: Dividend) {
    await fetch(`/api/other-dividends/${d.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: d.active ? 0 : 1 }),
    })
    load()
  }

  async function deleteDiv(id: number) {
    if (!confirm('배당 항목과 관련 수령 이력이 모두 삭제됩니다. 삭제하시겠습니까?')) return
    await fetch(`/api/other-dividends/${id}`, { method: 'DELETE' })
    load()
  }

  // ── 수령 이력 CRUD ──────────────────────────────────────────────────
  async function addRec() {
    if (!recForm.dividend_id) return
    setAddingRec(true)
    await fetch('/api/other-dividends/receipts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dividend_id:   Number(recForm.dividend_id),
        expected_date: recForm.expected_date || null,
        actual_date:   recForm.actual_date   || null,
        amount:        recForm.amount ? Number(recForm.amount) : null,
        memo:          recForm.memo   || null,
      }),
    })
    setAddingRec(false)
    setShowAddRec(false)
    setRecForm({ dividend_id: '', expected_date: '', actual_date: '', amount: '', memo: '' })
    load()
  }

  function startEditRec(r: Receipt) {
    setEditRecId(r.id)
    setEditRecForm({
      dividend_id:   String(r.dividend_id),
      expected_date: r.expected_date ?? '',
      actual_date:   r.actual_date   ?? '',
      amount:        r.actual_amount !== r.base_amount ? String(r.actual_amount) : '',
      memo:          r.memo ?? '',
    })
  }

  async function saveEditRec(id: number) {
    await fetch(`/api/other-dividends/receipts/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expected_date: editRecForm.expected_date || null,
        actual_date:   editRecForm.actual_date   || null,
        amount:        editRecForm.amount ? Number(editRecForm.amount) : null,
        memo:          editRecForm.memo   || null,
      }),
    })
    setEditRecId(null)
    load()
  }

  async function deleteRec(id: number) {
    if (!confirm('수령 기록을 삭제하시겠습니까?')) return
    await fetch(`/api/other-dividends/receipts/${id}`, { method: 'DELETE' })
    load()
  }

  // ── KPI 계산 ────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const curYM   = thisYM()
    const curYear = thisYear()

    const monthReceipts = receipts.filter(r =>
      (r.actual_date ?? r.expected_date ?? '').startsWith(curYM)
    )
    const yearReceipts = receipts.filter(r =>
      (r.actual_date ?? r.expected_date ?? '').startsWith(curYear)
    )

    const monthTotal = monthReceipts.reduce((s, r) => s + (r.currency === 'KRW' ? r.actual_amount : 0), 0)
    const yearTotal  = yearReceipts.reduce((s, r) => s + (r.currency === 'KRW' ? r.actual_amount : 0), 0)
    const activeCount = dividends.filter(d => d.active).length

    return { monthTotal, yearTotal, activeCount, totalReceipts: receipts.length }
  }, [dividends, receipts])

  // ── 월별 집계 ────────────────────────────────────────────────────────
  const monthlySummary = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of receipts) {
      const key = ym(r.actual_date ?? r.expected_date ?? '')
      if (!key || key.length < 7) continue
      if (r.currency !== 'KRW') continue // 단순화: KRW만 집계
      map.set(key, (map.get(key) ?? 0) + r.actual_amount)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [receipts])

  // ── 연간 집계 ────────────────────────────────────────────────────────
  const yearlySummary = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of receipts) {
      const key = (r.actual_date ?? r.expected_date ?? '').slice(0, 4)
      if (!key || key.length < 4) continue
      if (r.currency !== 'KRW') continue
      map.set(key, (map.get(key) ?? 0) + r.actual_amount)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [receipts])

  // ── 항목 탭: 필터 + 정렬 ────────────────────────────────────────────
  const filteredDividends = useMemo(() => {
    let list = dividends
    if (itemFilter === 'active') list = list.filter(d => d.active)
    if (itemFilter === 'ended')  list = list.filter(d => !d.active)
    if (typeFilter === 'recurring')  list = list.filter(d => d.type === 'recurring')
    if (typeFilter === 'short_term') list = list.filter(d => d.type === 'short_term')

    if (sortKey) {
      list = [...list].sort((a, b) => {
        let va: number | string = 0
        let vb: number | string = 0
        if (sortKey === 'name')          { va = a.name; vb = b.name }
        if (sortKey === 'amount')        { va = a.amount;          vb = b.amount }
        if (sortKey === 'principal')     { va = a.principal ?? 0;  vb = b.principal ?? 0 }
        if (sortKey === 'scheduled_day') { va = a.scheduled_day ?? 99; vb = b.scheduled_day ?? 99 }
        if (sortKey === 'total_received'){ va = a.total_received ?? 0; vb = b.total_received ?? 0 }
        if (sortKey === 'yield') {
          va = a.principal && a.principal > 0 ? (a.amount * 12 / a.principal) : 0
          vb = b.principal && b.principal > 0 ? (b.amount * 12 / b.principal) : 0
        }
        if (typeof va === 'string') return sortDesc ? vb.toString().localeCompare(va) : va.localeCompare(vb.toString())
        return sortDesc ? (vb as number) - (va as number) : (va as number) - (vb as number)
      })
    }
    return list
  }, [dividends, itemFilter, typeFilter, sortKey, sortDesc])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center"><div className="text-2xl mb-2">💸</div><p className="text-sm">로딩 중…</p></div>
    </div>
  )

  // ── 렌더 ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-full p-6 space-y-6">

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">💸 기타 배당</h1>
          <p className="text-sm text-[#64748B] mt-1">정기·단기 배당 수령 현황 및 예상일 추적</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowAddRec(v => !v); setShowAddDiv(false); setActiveTab('history') }}
            className="px-4 py-2 text-sm border border-[#E2E8F0] rounded-lg hover:bg-slate-50 text-[#64748B]">
            + 수령 기록
          </button>
          <button onClick={() => { setShowAddDiv(v => !v); setShowAddRec(false); setActiveTab('items') }}
            className="px-4 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            + 배당 항목 추가
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs text-[#64748B] mb-1">이번달 수령 (원화)</p>
          <p className="text-xl font-bold text-[#0F172A]">₩{Math.round(kpi.monthTotal).toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-[#1A56DB] p-4">
          <p className="text-xs text-[#64748B] mb-1">올해 누적 (원화)</p>
          <p className="text-xl font-bold text-[#1A56DB]">₩{Math.round(kpi.yearTotal).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs text-[#64748B] mb-1">활성 배당 항목</p>
          <p className="text-xl font-bold text-[#0F172A]">{kpi.activeCount}건</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-xs text-[#64748B] mb-1">총 수령 이력</p>
          <p className="text-xl font-bold text-[#0F172A]">{kpi.totalReceipts}건</p>
        </div>
      </div>

      {/* 배당 항목 추가 폼 */}
      {showAddDiv && (
        <div className="bg-white rounded-xl border border-[#1A56DB]/30 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">새 배당 항목 추가</h3>
          <DivForm form={divForm} setForm={setDivForm} />
          <div className="flex gap-2 justify-end mt-4">
            <button onClick={() => setShowAddDiv(false)} className="px-4 py-2 text-sm border border-[#E2E8F0] rounded-lg hover:bg-slate-50">취소</button>
            <button onClick={addDiv} disabled={addingDiv || !divForm.name || !divForm.amount}
              className="px-4 py-2 text-sm bg-[#1A56DB] text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {addingDiv ? '추가 중…' : '추가'}
            </button>
          </div>
        </div>
      )}

      {/* 수령 기록 추가 폼 */}
      {showAddRec && (
        <div className="bg-white rounded-xl border border-[#1A56DB]/30 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">수령 기록 추가</h3>
          <RecForm form={recForm} setForm={setRecForm} dividends={dividends} />
          <div className="flex gap-2 justify-end mt-4">
            <button onClick={() => setShowAddRec(false)} className="px-4 py-2 text-sm border border-[#E2E8F0] rounded-lg hover:bg-slate-50">취소</button>
            <button onClick={addRec} disabled={addingRec || !recForm.dividend_id}
              className="px-4 py-2 text-sm bg-[#1A56DB] text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {addingRec ? '추가 중…' : '추가'}
            </button>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {([
            ['items',   '📋 배당 항목'],
            ['history', '📥 수령 이력'],
            ['monthly', '📆 월별'],
            ['yearly',  '📊 연간'],
          ] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
                activeTab === tab ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* 항목 탭 전용: 활성/종료/전체 + 장기/단기 필터 */}
        {activeTab === 'items' && (
          <>
            <div className="flex gap-1">
              {([['active', '✅ 활성'], ['ended', '🔴 종료'], ['all', '전체']] as const).map(([f, label]) => (
                <button key={f} onClick={() => setItemFilter(f)}
                  className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                    itemFilter === f ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-slate-50'
                  }`}>
                  {label}
                  <span className="ml-1 opacity-60">
                    {f === 'active' ? dividends.filter(d=>d.active).length :
                     f === 'ended'  ? dividends.filter(d=>!d.active).length :
                     dividends.length}
                  </span>
                </button>
              ))}
            </div>
            {/* 구분선 */}
            <span className="text-slate-300 text-xs">|</span>
            <div className="flex gap-1">
              {([['all', '전체'], ['recurring', '🔵 장기'], ['short_term', '🟡 단기']] as const).map(([f, label]) => (
                <button key={f} onClick={() => setTypeFilter(f)}
                  className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                    typeFilter === f ? 'bg-[#1A56DB] text-white border-[#1A56DB]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-slate-50'
                  }`}>
                  {label}
                  <span className="ml-1 opacity-60">
                    {f === 'all'        ? dividends.length :
                     f === 'recurring'  ? dividends.filter(d=>d.type==='recurring').length :
                     dividends.filter(d=>d.type==='short_term').length}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ══ 배당 항목 탭 ══ */}
      {activeTab === 'items' && (
        filteredDividends.length === 0 ? (
          <EmptyState icon="💸"
            msg={itemFilter === 'ended' ? '종료된 항목이 없습니다' : '등록된 배당 항목이 없습니다'}
            sub="+ 배당 항목 추가 버튼으로 시작하세요" />
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="max-h-[560px] overflow-y-auto relative">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs">
                  {/* 정렬 가능 헤더 — IIFE */}
                  {(() => {
                    const Th = ({ k, align = 'right', children }: { k: SortKey | null; align?: string; children: React.ReactNode }) => (
                      <th
                        onClick={k ? () => toggleSort(k) : undefined}
                        className={`px-3 py-3 font-medium text-[#64748B] whitespace-nowrap select-none ${
                          align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right'
                        } ${k ? 'cursor-pointer hover:text-[#0F172A] hover:bg-slate-100 transition-colors' : ''}`}
                      >
                        {children}
                        {k && sortKey === k && (
                          <span className="ml-1 text-[#1A56DB]">{sortDesc ? '↓' : '↑'}</span>
                        )}
                      </th>
                    )
                    return (
                      <>
                        <Th k="name" align="left">항목명</Th>
                        <Th k={null} align="center">유형</Th>
                        <Th k="amount">금액</Th>
                        <Th k="scheduled_day" align="center">예상 배당일</Th>
                        <Th k={null} align="left">기간</Th>
                        <Th k="principal">원금</Th>
                        <Th k="yield">연수익률</Th>
                        <Th k={null} align="center">이번달 수령</Th>
                        <Th k="total_received">누적 수령</Th>
                        <Th k={null} align="center">상태</Th>
                        <Th k={null} align="center">액션</Th>
                      </>
                    )
                  })()}
                </tr>
              </thead>
              <tbody>
                {filteredDividends.map(d => {
                  const isEdit = editDivId === d.id
                  const thisMonthRec = thisMonthReceipt(d.id)
                  const isQuickOpen  = quickRecDivId === d.id
                  return (
                    <>
                    <tr key={d.id} className={`border-b ${isQuickOpen ? 'border-[#1A56DB]/20' : 'border-[#E2E8F0]'} transition-colors ${d.active ? 'hover:bg-slate-50/40' : 'opacity-50 bg-slate-50/30'}`}>
                      {isEdit ? (
                        <td colSpan={8} className="px-4 py-3">
                          <DivForm form={editDivForm} setForm={setEditDivForm} />
                          <div className="flex gap-2 justify-end mt-3">
                            <button onClick={() => setEditDivId(null)} className="text-xs px-3 py-1.5 border border-[#E2E8F0] rounded hover:bg-slate-50">취소</button>
                            <button onClick={() => saveEditDiv(d.id)} className="text-xs px-3 py-1.5 bg-[#1A56DB] text-white rounded hover:bg-blue-700">저장</button>
                          </div>
                        </td>
                      ) : (
                        <>
                          {/* 항목명 */}
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#0F172A] text-xs">{d.name}</p>
                            {d.memo && <p className="text-[10px] text-[#94A3B8] mt-0.5">{d.memo}</p>}
                          </td>
                          {/* 유형 */}
                          <td className="px-3 py-3 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              d.type === 'recurring' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {TYPE_LABEL[d.type] ?? d.type}
                              {d.type === 'short_term' && d.period_value && d.period_type
                                ? ` ${d.period_value}${PERIOD_LABEL[d.period_type]}`
                                : ''}
                            </span>
                          </td>
                          {/* 금액 */}
                          <td className="px-3 py-3 text-right text-xs font-medium tabular">
                            {fmt(d.amount, d.currency)}
                          </td>
                          {/* 예상 배당일 */}
                          <td className="px-2 py-3 text-center text-xs text-[#64748B] whitespace-nowrap">
                            {d.scheduled_day ? `매월 ${d.scheduled_day}일` : '–'}
                          </td>
                          {/* 기간 */}
                          <td className="px-2 py-3 text-xs text-[#64748B] whitespace-nowrap">
                            {d.start_date
                              ? `'${d.start_date.slice(2,4)}.${d.start_date.slice(5,7)}`
                              : '–'}
                            {d.end_date
                              ? `~'${d.end_date.slice(2,4)}.${d.end_date.slice(5,7)}`
                              : d.type === 'recurring' ? '~계속' : ''}
                          </td>
                          {/* 원금 */}
                          <td className="px-3 py-3 text-right text-xs tabular text-[#64748B]">
                            {d.principal != null
                              ? fmt(d.principal, d.currency)
                              : <span className="text-slate-300">–</span>}
                          </td>
                          {/* 연수익률 */}
                          <td className="px-3 py-3 text-right text-xs tabular">
                            {d.principal != null && d.principal > 0 ? (() => {
                              const annualDiv = d.amount * 12
                              const rate = (annualDiv / d.principal) * 100
                              return <span className="text-emerald-600 font-medium">{rate.toFixed(2)}%</span>
                            })() : <span className="text-slate-300">–</span>}
                          </td>
                          {/* 이번달 수령 */}
                          <td className="px-3 py-3 text-center text-xs">
                            {thisMonthRec ? (
                              <div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                  ✓ 수령완료
                                </span>
                                <p className="text-[10px] text-[#94A3B8] mt-0.5">{thisMonthRec.actual_date ?? thisMonthRec.expected_date}</p>
                              </div>
                            ) : d.active ? (
                              <button
                                onClick={() => isQuickOpen ? setQuickRecDivId(null) : openQuickRec(d)}
                                className={`text-[10px] px-2 py-1 rounded-lg border font-medium transition-colors ${
                                  isQuickOpen
                                    ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
                                    : 'border-slate-200 text-[#64748B] hover:border-[#1A56DB] hover:text-[#1A56DB]'
                                }`}>
                                {isQuickOpen ? '닫기' : '수령 입력'}
                              </button>
                            ) : <span className="text-slate-300">–</span>}
                          </td>
                          {/* 누적 */}
                          <td className="px-3 py-3 text-right text-xs tabular">
                            {d.total_received != null
                              ? <span className="text-emerald-600 font-medium">{fmt(d.total_received, d.currency)}</span>
                              : <span className="text-slate-300">–</span>}
                            {d.receipt_count > 0 && (
                              <p className="text-[10px] text-[#94A3B8]">{d.receipt_count}회</p>
                            )}
                          </td>
                          {/* 상태 */}
                          <td className="px-3 py-3 text-center">
                            <button onClick={() => toggleActive(d)}
                              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                                d.active
                                  ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                  : 'border-slate-200 text-slate-400 bg-slate-50 hover:bg-slate-100'
                              }`}>
                              {d.active ? '활성' : '종료'}
                            </button>
                          </td>
                          {/* 액션 */}
                          <td className="px-3 py-3">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => startEditDiv(d)}
                                className="text-xs px-2 py-1 border border-[#E2E8F0] rounded hover:bg-slate-50 text-[#64748B]">✏️</button>
                              <button onClick={() => deleteDiv(d.id)}
                                className="text-xs px-2 py-1 border border-red-200 text-red-400 rounded hover:bg-red-50">✕</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>

                    {/* 인라인 수령 입력 폼 */}
                    {isQuickOpen && !isEdit && (
                      <tr key={`quick-${d.id}`} className="border-b border-[#1A56DB]/20 bg-blue-50/30">
                        <td colSpan={10} className="px-4 py-3">
                          <div className="flex items-end gap-3">
                            <div>
                              <label className="text-[10px] text-[#64748B] mb-1 block">예상 수령일</label>
                              <input type="date" value={quickRecForm.expected_date}
                                onChange={e => setQuickRecForm(f => ({ ...f, expected_date: e.target.value }))}
                                className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#1A56DB]" />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#64748B] mb-1 block">실제 수령일 *</label>
                              <input type="date" value={quickRecForm.actual_date}
                                onChange={e => setQuickRecForm(f => ({ ...f, actual_date: e.target.value }))}
                                className="border border-[#1A56DB] rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#64748B] mb-1 block">
                                실제 금액 <span className="text-slate-400">(기본: {fmt(d.amount, d.currency)})</span>
                              </label>
                              <input type="number" min="0" value={quickRecForm.amount}
                                onChange={e => setQuickRecForm(f => ({ ...f, amount: e.target.value }))}
                                placeholder="다를 경우 입력"
                                className="w-32 border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#1A56DB]" />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-[#64748B] mb-1 block">메모</label>
                              <input value={quickRecForm.memo}
                                onChange={e => setQuickRecForm(f => ({ ...f, memo: e.target.value }))}
                                placeholder="선택"
                                className="w-full border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#1A56DB]" />
                            </div>
                            <div className="flex gap-2 pb-0.5">
                              <button onClick={() => setQuickRecDivId(null)}
                                className="px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-lg hover:bg-slate-50">취소</button>
                              <button onClick={() => saveQuickRec(d)} disabled={savingQuick || !quickRecForm.actual_date}
                                className="px-3 py-1.5 text-xs bg-[#1A56DB] text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                {savingQuick ? '저장 중…' : '수령 확인'}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  )
                })}
              </tbody>
              {/* 합계 행 */}
              {(() => {
                const totalPrincipal     = filteredDividends.reduce((s, d) => s + (d.principal ?? 0), 0)
                const totalAmount        = filteredDividends.reduce((s, d) => s + d.amount, 0)
                const totalReceived      = filteredDividends.reduce((s, d) => s + (d.total_received ?? 0), 0)
                const hasPrincipal       = filteredDividends.some(d => d.principal != null && d.principal > 0)
                // 가중평균 연수익률: 원금이 있는 항목들만
                const yieldItems         = filteredDividends.filter(d => d.principal != null && d.principal > 0)
                const weightedYieldSum   = yieldItems.reduce((s, d) => s + (d.amount * 12), 0)
                const weightedPrincipal  = yieldItems.reduce((s, d) => s + (d.principal ?? 0), 0)
                const avgYield           = weightedPrincipal > 0 ? (weightedYieldSum / weightedPrincipal) * 100 : null
                return (
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-[#E2E8F0] text-xs font-semibold text-[#0F172A]">
                      <td className="px-4 py-3 text-[#64748B] font-medium">
                        합계 <span className="font-normal text-[10px] text-slate-400">({filteredDividends.length}건)</span>
                      </td>
                      <td />
                      <td className="px-3 py-3 text-right tabular">
                        {fmt(totalAmount, 'KRW')}
                        <p className="text-[10px] text-[#64748B] font-normal">월 합계</p>
                      </td>
                      <td /><td />
                      <td className="px-3 py-3 text-right tabular">
                        {hasPrincipal ? fmt(totalPrincipal, 'KRW') : <span className="text-slate-300">–</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular">
                        {avgYield != null
                          ? <span className="text-emerald-600">{avgYield.toFixed(2)}%</span>
                          : <span className="text-slate-300">–</span>}
                        {avgYield != null && <p className="text-[10px] text-[#64748B] font-normal">가중평균</p>}
                      </td>
                      <td />
                      <td className="px-3 py-3 text-right tabular">
                        <span className="text-emerald-600">{fmt(totalReceived, 'KRW')}</span>
                      </td>
                      <td /><td />
                    </tr>
                  </tfoot>
                )
              })()}
            </table>
            </div>{/* max-h scroll end */}
          </div>
        )
      )}

      {/* ══ 수령 이력 탭 ══ */}
      {activeTab === 'history' && (
        receipts.length === 0 ? (
          <EmptyState icon="📥" msg="수령 기록이 없습니다" sub="+ 수령 기록 버튼으로 실제 수령 내역을 입력하세요" />
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2E8F0] text-xs">
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">항목</th>
                  <th className="text-center px-3 py-3 font-medium text-[#64748B]">예상 수령일</th>
                  <th className="text-center px-3 py-3 font-medium text-[#64748B]">실제 수령일</th>
                  <th className="text-center px-3 py-3 font-medium text-[#64748B]">차이</th>
                  <th className="text-right px-3 py-3 font-medium text-[#64748B]">금액</th>
                  <th className="text-left px-3 py-3 font-medium text-[#64748B]">메모</th>
                  <th className="text-center px-3 py-3 font-medium text-[#64748B]">액션</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map(r => {
                  const isEdit = editRecId === r.id
                  return (
                    <tr key={r.id} className="border-b border-[#E2E8F0] last:border-0 hover:bg-slate-50/40">
                      {isEdit ? (
                        <td colSpan={7} className="px-4 py-3">
                          <RecForm form={editRecForm} setForm={setEditRecForm} dividends={dividends} />
                          <div className="flex gap-2 justify-end mt-3">
                            <button onClick={() => setEditRecId(null)} className="text-xs px-3 py-1.5 border border-[#E2E8F0] rounded hover:bg-slate-50">취소</button>
                            <button onClick={() => saveEditRec(r.id)} className="text-xs px-3 py-1.5 bg-[#1A56DB] text-white rounded hover:bg-blue-700">저장</button>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-xs font-medium text-[#0F172A]">{r.dividend_name}</td>
                          <td className="px-3 py-3 text-center text-xs text-[#64748B]">{r.expected_date ?? '–'}</td>
                          <td className="px-3 py-3 text-center text-xs font-medium text-[#0F172A]">{r.actual_date ?? '–'}</td>
                          <td className="px-3 py-3 text-center text-xs">
                            {r.day_diff != null ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                r.day_diff === 0 ? 'bg-emerald-100 text-emerald-700' :
                                r.day_diff > 0  ? 'bg-amber-100 text-amber-700' :
                                                  'bg-blue-100 text-blue-700'
                              }`}>
                                {r.day_diff === 0 ? '예정일' : r.day_diff > 0 ? `+${r.day_diff}일 지연` : `${Math.abs(r.day_diff)}일 빠름`}
                              </span>
                            ) : <span className="text-slate-300">–</span>}
                          </td>
                          <td className="px-3 py-3 text-right text-xs font-medium tabular text-emerald-600">
                            {fmt(r.actual_amount, r.currency)}
                          </td>
                          <td className="px-3 py-3 text-xs text-[#94A3B8]">{r.memo ?? ''}</td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => startEditRec(r)}
                                className="text-xs px-2 py-1 border border-[#E2E8F0] rounded hover:bg-slate-50 text-[#64748B]">✏️</button>
                              <button onClick={() => deleteRec(r.id)}
                                className="text-xs px-2 py-1 border border-red-200 text-red-400 rounded hover:bg-red-50">✕</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ══ 월별 탭 ══ */}
      {activeTab === 'monthly' && (
        monthlySummary.length === 0 ? (
          <EmptyState icon="📆" msg="수령 이력이 없습니다" sub="수령 기록을 입력하면 월별 집계가 표시됩니다" />
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E2E8F0] bg-slate-50">
              <p className="text-sm font-semibold text-[#0F172A]">월별 수령 합계 (원화 기준)</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/50 border-b border-[#E2E8F0] text-xs">
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">연월</th>
                  <th className="text-right px-3 py-3 font-medium text-[#64748B]">수령 금액</th>
                  <th className="text-right px-3 py-3 font-medium text-[#64748B]">누적</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let cum = 0
                  return monthlySummary.map(([month, total]) => {
                    cum += total
                    const isCur = month === thisYM()
                    return (
                      <tr key={month} className={`border-b border-[#E2E8F0] last:border-0 ${isCur ? 'bg-blue-50/40' : 'hover:bg-slate-50/40'}`}>
                        <td className="px-4 py-3 text-xs font-medium text-[#0F172A]">
                          {month}
                          {isCur && <span className="ml-2 text-[10px] bg-[#1A56DB] text-white px-1.5 py-0.5 rounded-full">이번달</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-xs font-semibold text-emerald-600 tabular">
                          ₩{Math.round(total).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-[#64748B] tabular">
                          ₩{Math.round(cum).toLocaleString()}
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ══ 연간 탭 ══ */}
      {activeTab === 'yearly' && (
        yearlySummary.length === 0 ? (
          <EmptyState icon="📊" msg="수령 이력이 없습니다" sub="수령 기록을 입력하면 연간 집계가 표시됩니다" />
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E2E8F0] bg-slate-50">
              <p className="text-sm font-semibold text-[#0F172A]">연간 수령 합계 (원화 기준)</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/50 border-b border-[#E2E8F0] text-xs">
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">연도</th>
                  <th className="text-right px-3 py-3 font-medium text-[#64748B]">총 수령</th>
                  <th className="text-right px-3 py-3 font-medium text-[#64748B]">월평균</th>
                </tr>
              </thead>
              <tbody>
                {yearlySummary.map(([year, total]) => {
                  const isCur = year === thisYear()
                  const months = isCur ? new Date().getMonth() + 1 : 12
                  return (
                    <tr key={year} className={`border-b border-[#E2E8F0] last:border-0 ${isCur ? 'bg-blue-50/40' : 'hover:bg-slate-50/40'}`}>
                      <td className="px-4 py-3 text-xs font-medium text-[#0F172A]">
                        {year}년
                        {isCur && <span className="ml-2 text-[10px] bg-[#1A56DB] text-white px-1.5 py-0.5 rounded-full">올해</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-bold text-emerald-600 tabular">
                        ₩{Math.round(total).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-[#64748B] tabular">
                        ₩{Math.round(total / months).toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      <p className="text-[10px] text-slate-400">
        ※ 월별·연간 집계는 원화 기준입니다. USD 배당은 별도 수령 기록에 반영되며 집계에서 제외됩니다.
      </p>
    </div>
  )
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────────────

function EmptyState({ icon, msg, sub }: { icon: string; msg: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-16 text-center">
      <p className="text-4xl mb-4">{icon}</p>
      <p className="text-[#64748B] font-medium">{msg}</p>
      <p className="text-sm text-[#94A3B8] mt-2">{sub}</p>
    </div>
  )
}

type DivFormState = {
  name: string; amount: string; currency: string; type: string
  period_type: string; period_value: string
  scheduled_day: string; start_date: string; end_date: string; memo: string; principal: string
}

function DivForm({ form, setForm }: { form: DivFormState; setForm: React.Dispatch<React.SetStateAction<DivFormState>> }) {
  const inp = 'w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#1A56DB] bg-white'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="text-[10px] text-[#64748B] mb-1 block">항목명 *</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="예: 저축은행 이자, 리츠 배당" className={inp} />
        </div>
        <div>
          <label className="text-[10px] text-[#64748B] mb-1 block">원금 <span className="text-slate-400">(선택)</span></label>
          <input type="number" min="0" value={form.principal} onChange={e => setForm(f => ({ ...f, principal: e.target.value }))}
            placeholder="예: 10000000" className={inp} />
        </div>
        <div>
          <label className="text-[10px] text-[#64748B] mb-1 block">월 배당금 *</label>
          <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="0" className={inp} />
        </div>
        <div>
          <label className="text-[10px] text-[#64748B] mb-1 block">통화</label>
          <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className={inp}>
            <option value="KRW">KRW (원화)</option>
            <option value="USD">USD (달러)</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] text-[#64748B] mb-1 block">유형</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
            <option value="recurring">계속 (정기)</option>
            <option value="short_term">단기</option>
          </select>
        </div>
        {form.type === 'short_term' && (
          <>
            <div>
              <label className="text-[10px] text-[#64748B] mb-1 block">단위</label>
              <select value={form.period_type} onChange={e => setForm(f => ({ ...f, period_type: e.target.value }))} className={inp}>
                <option value="monthly">월</option>
                <option value="daily">일</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#64748B] mb-1 block">기간</label>
              <input type="number" min="1" value={form.period_value}
                onChange={e => setForm(f => ({ ...f, period_value: e.target.value }))}
                placeholder="예: 6" className={inp} />
            </div>
          </>
        )}
        <div>
          <label className="text-[10px] text-[#64748B] mb-1 block">예상 배당일 (매월 N일)</label>
          <input type="number" min="1" max="31" value={form.scheduled_day}
            onChange={e => setForm(f => ({ ...f, scheduled_day: e.target.value }))}
            placeholder="예: 15" className={inp} />
        </div>
        <div>
          <label className="text-[10px] text-[#64748B] mb-1 block">시작일</label>
          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className={inp} />
        </div>
        {form.type === 'short_term' && (
          <div>
            <label className="text-[10px] text-[#64748B] mb-1 block">종료일</label>
            <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className={inp} />
          </div>
        )}
      </div>
      <div>
        <label className="text-[10px] text-[#64748B] mb-1 block">메모 (선택)</label>
        <input value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
          placeholder="비고" className={inp} />
      </div>
    </div>
  )
}

type RecFormState = { dividend_id: string; expected_date: string; actual_date: string; amount: string; memo: string }

function RecForm({ form, setForm, dividends }: {
  form: RecFormState
  setForm: React.Dispatch<React.SetStateAction<RecFormState>>
  dividends: Dividend[]
}) {
  const inp = 'w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#1A56DB] bg-white'
  const selected = dividends.find(d => d.id === Number(form.dividend_id))
  return (
    <div className="grid grid-cols-5 gap-3">
      <div className="col-span-2">
        <label className="text-[10px] text-[#64748B] mb-1 block">배당 항목 *</label>
        <select value={form.dividend_id} onChange={e => setForm(f => ({ ...f, dividend_id: e.target.value }))} className={inp}>
          <option value="">선택하세요</option>
          {dividends.map(d => (
            <option key={d.id} value={d.id}>{d.name} ({CURRENCY_LABEL[d.currency]}{d.amount.toLocaleString()})</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-[#64748B] mb-1 block">예상 수령일</label>
        <input type="date" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} className={inp} />
      </div>
      <div>
        <label className="text-[10px] text-[#64748B] mb-1 block">실제 수령일</label>
        <input type="date" value={form.actual_date} onChange={e => setForm(f => ({ ...f, actual_date: e.target.value }))} className={inp} />
      </div>
      <div>
        <label className="text-[10px] text-[#64748B] mb-1 block">
          실제 금액 <span className="text-slate-400">(기본: {selected ? fmt(selected.amount, selected.currency) : '–'})</span>
        </label>
        <input type="number" min="0" value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          placeholder="다를 경우 입력" className={inp} />
      </div>
      <div className="col-span-5">
        <label className="text-[10px] text-[#64748B] mb-1 block">메모 (선택)</label>
        <input value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="메모" className={inp} />
      </div>
    </div>
  )
}
