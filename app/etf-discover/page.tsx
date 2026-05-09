'use client'

import { useEffect, useState, useMemo } from 'react'

interface EtfItem {
  ticker: string
  name: string
  category: string
  div_yield: number | null
  expense_ratio: number | null
  aum: number | null
  div_frequency: string | null
  inception_year: number | null
  description: string | null
  screened_at: string | null
  inWatchlist: boolean
}

const CATEGORY_LABEL: Record<string, string> = {
  dividend_growth: '배당성장',
  high_dividend:   '고배당',
  covered_call:    '커버드콜',
  aristocrat:      '귀족·킹',
  reit:            '리츠',
  international:   '글로벌',
}

const CATEGORY_COLOR: Record<string, string> = {
  dividend_growth: 'bg-emerald-100 text-emerald-800',
  high_dividend:   'bg-blue-100 text-blue-800',
  covered_call:    'bg-violet-100 text-violet-800',
  aristocrat:      'bg-amber-100 text-amber-800',
  reit:            'bg-orange-100 text-orange-800',
  international:   'bg-sky-100 text-sky-800',
}

const FREQ_LABEL: Record<string, string> = {
  monthly:   '월배당',
  quarterly: '분기배당',
  annual:    '연배당',
  unknown:   '?',
}

const FREQ_COLOR: Record<string, string> = {
  monthly:   'bg-green-100 text-green-700',
  quarterly: 'bg-blue-100 text-blue-700',
  annual:    'bg-gray-100 text-gray-600',
  unknown:   'bg-gray-50 text-gray-400',
}

type Tab = 'all' | 'dividend_growth' | 'high_dividend' | 'covered_call' | 'aristocrat' | 'reit' | 'international'

function fmtAum(aum: number | null) {
  if (!aum) return 'N/A'
  if (aum >= 1e9) return `$${(aum / 1e9).toFixed(0)}B`
  if (aum >= 1e6) return `$${(aum / 1e6).toFixed(0)}M`
  return `$${aum.toLocaleString()}`
}

function AumBar({ aum, maxAum }: { aum: number | null; maxAum: number }) {
  if (!aum || !maxAum) return null
  const pct = Math.min((aum / maxAum) * 100, 100)
  return (
    <div className="w-full h-1 bg-[#E2E8F0] rounded-full overflow-hidden mt-1">
      <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function EtfDiscoverPage() {
  const [etfs, setEtfs] = useState<EtfItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('all')
  const [minYield, setMinYield] = useState(0)
  const [maxExpense, setMaxExpense] = useState(1.0)
  const [freqFilter, setFreqFilter] = useState<string>('전체')
  const [searchQuery, setSearchQuery] = useState('')
  const [showWatchlist, setShowWatchlist] = useState(false)
  const [addedSet, setAddedSet] = useState<Set<string>>(new Set())
  const [addingTicker, setAddingTicker] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/etf-universe')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setEtfs(d.etfs || [])
        // 이미 후보함에 있는 것 표시
        const existing = new Set<string>((d.etfs || []).filter((e: EtfItem) => e.inWatchlist).map((e: EtfItem) => e.ticker))
        setAddedSet(existing)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const maxAum = useMemo(() => Math.max(...etfs.map(e => e.aum ?? 0)), [etfs])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toUpperCase()
    return etfs.filter(e => {
      // 검색 모드
      if (q) {
        return e.ticker.includes(q) || (e.name || '').toUpperCase().includes(q)
      }
      // 탭 필터
      if (tab !== 'all' && e.category !== tab) return false
      // 배당률 필터
      if (minYield > 0 && (e.div_yield ?? 0) < minYield) return false
      // 운용보수 필터
      if (e.expense_ratio !== null && e.expense_ratio > maxExpense) return false
      // 배당주기 필터
      if (freqFilter !== '전체' && e.div_frequency !== freqFilter) return false
      // 후보함 제외
      if (!showWatchlist && e.inWatchlist) return false
      return true
    })
  }, [etfs, tab, minYield, maxExpense, freqFilter, searchQuery, showWatchlist])

  async function addToWatchlist(e: EtfItem) {
    if (addingTicker) return
    setAddingTicker(e.ticker)
    try {
      const res = await fetch('/api/etf-universe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: e.ticker, name: e.name, asset_type: 'us_etf' }),
      })
      if (res.ok) {
        setAddedSet(prev => new Set([...prev, e.ticker]))
        setEtfs(prev => prev.map(item => item.ticker === e.ticker ? { ...item, inWatchlist: true } : item))
      }
    } finally {
      setAddingTicker(null)
    }
  }

  const isSearching = searchQuery.trim().length > 0

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all',            label: '전체' },
    { key: 'dividend_growth', label: '배당성장' },
    { key: 'high_dividend',  label: '고배당' },
    { key: 'covered_call',   label: '커버드콜' },
    { key: 'aristocrat',     label: '귀족·킹' },
    { key: 'reit',           label: '리츠' },
    { key: 'international',  label: '글로벌' },
  ]

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    etfs.forEach(e => {
      counts[e.category] = (counts[e.category] ?? 0) + 1
    })
    return counts
  }, [etfs])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#64748B]">
      <div className="text-center">
        <div className="text-2xl mb-2">🏦</div>
        <p className="text-sm">ETF 유니버스 로딩 중…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="p-6 text-red-500 text-sm">오류: {error}</div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] flex items-center gap-2">
            🏦 ETF 신규 발굴
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            미국 배당 ETF {etfs.length}종 · 카테고리별 탐색 · 후보함 추가
          </p>
        </div>
        <div className="text-right text-xs text-[#94A3B8]">
          <p>수집 데이터 기준</p>
          <p className="text-[10px] mt-0.5">주 1회 자동 갱신 예정</p>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTab(key as Tab); setSearchQuery('') }}
            className={`rounded-xl p-3 text-center transition-all border ${
              tab === key && !isSearching
                ? 'border-[#3B82F6] bg-blue-50'
                : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
            }`}
          >
            <p className="text-lg font-bold text-[#1E293B]">{categoryCounts[key] ?? 0}</p>
            <p className="text-[11px] text-[#64748B] mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="mb-4">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-sm">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="티커 또는 ETF 이름 검색 (예: SCHD, JPMorgan)"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] text-xs"
            >✕</button>
          )}
        </div>
      </div>

      {/* 탭 + 필터 (검색 중이면 dimmed) */}
      <div className={isSearching ? 'opacity-40 pointer-events-none' : ''}>
        {/* 탭 */}
        <div className="flex gap-1 mb-4 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-[#1E293B] text-white'
                  : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 필터 바 */}
        <div className="flex flex-wrap gap-4 items-center mb-5 bg-white rounded-xl border border-[#E2E8F0] px-4 py-3">
          <label className="flex items-center gap-2 text-xs text-[#64748B]">
            <span className="font-medium whitespace-nowrap">최소 배당률</span>
            <input
              type="range" min={0} max={12} step={0.5} value={minYield}
              onChange={e => setMinYield(Number(e.target.value))}
              className="w-24"
            />
            <span className="w-10 text-right font-semibold text-[#1E293B]">
              {minYield === 0 ? '전체' : `${minYield}%+`}
            </span>
          </label>

          <label className="flex items-center gap-2 text-xs text-[#64748B]">
            <span className="font-medium whitespace-nowrap">최대 운용보수</span>
            <input
              type="range" min={0.01} max={1.0} step={0.01} value={maxExpense}
              onChange={e => setMaxExpense(Number(e.target.value))}
              className="w-24"
            />
            <span className="w-14 text-right font-semibold text-[#1E293B]">
              {maxExpense >= 1.0 ? '전체' : `${maxExpense.toFixed(2)}%`}
            </span>
          </label>

          <label className="flex items-center gap-2 text-xs text-[#64748B]">
            <span className="font-medium whitespace-nowrap">배당주기</span>
            <select
              value={freqFilter}
              onChange={e => setFreqFilter(e.target.value)}
              className="text-xs border border-[#E2E8F0] rounded-lg px-2 py-1 text-[#1E293B] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
            >
              {['전체', 'monthly', 'quarterly', 'annual'].map(f => (
                <option key={f} value={f}>{f === '전체' ? '전체' : FREQ_LABEL[f]}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={showWatchlist}
              onChange={e => setShowWatchlist(e.target.checked)}
              className="rounded"
            />
            <span className="text-[#64748B]">후보함 포함</span>
          </label>
        </div>
      </div>

      {/* 결과 수 */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-[#64748B]">
          {isSearching
            ? `"${searchQuery.trim()}" 검색 결과 ${filtered.length}개`
            : `${filtered.length}개 ETF`}
        </p>
        {filtered.length > 0 && (
          <p className="text-xs text-[#94A3B8]">배당률 높은 순</p>
        )}
      </div>

      {/* ETF 카드 그리드 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#94A3B8]">
          <div className="text-3xl mb-3">🔭</div>
          <p className="text-sm">조건에 맞는 ETF가 없습니다</p>
          <p className="text-xs mt-1">필터를 조정해 보세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...filtered].sort((a, b) => (b.div_yield ?? 0) - (a.div_yield ?? 0)).map(e => {
            const added = addedSet.has(e.ticker)
            const isAdding = addingTicker === e.ticker
            const catColor = CATEGORY_COLOR[e.category] ?? 'bg-gray-100 text-gray-600'
            const freqLabel = e.div_frequency ? FREQ_LABEL[e.div_frequency] ?? e.div_frequency : null
            const freqColor = e.div_frequency ? FREQ_COLOR[e.div_frequency] ?? 'bg-gray-100 text-gray-600' : ''

            return (
              <div
                key={e.ticker}
                className={`bg-white rounded-xl border transition-all ${
                  added
                    ? 'border-[#3B82F6] bg-blue-50/30'
                    : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-sm'
                }`}
              >
                {/* 카드 헤더 */}
                <div className="px-4 pt-4 pb-3 border-b border-[#F1F5F9]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-[#1E293B]">{e.ticker}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${catColor}`}>
                          {CATEGORY_LABEL[e.category]}
                        </span>
                        {freqLabel && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${freqColor}`}>
                            {freqLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#64748B] mt-1 truncate" title={e.name}>{e.name}</p>
                    </div>
                    {/* 배당률 */}
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-[#059669]">
                        {e.div_yield !== null ? `${e.div_yield.toFixed(2)}%` : '—'}
                      </p>
                      <p className="text-[10px] text-[#94A3B8]">배당률</p>
                    </div>
                  </div>
                </div>

                {/* 카드 바디 */}
                <div className="px-4 py-3 space-y-2">
                  {/* 설명 */}
                  {e.description && (
                    <p className="text-xs text-[#475569] leading-relaxed">{e.description}</p>
                  )}

                  {/* 지표 행 */}
                  <div className="flex gap-4 text-xs mt-2">
                    <div>
                      <p className="text-[#94A3B8]">운용보수</p>
                      <p className="font-semibold text-[#1E293B]">
                        {e.expense_ratio !== null
                          ? `${e.expense_ratio < 0.01 ? e.expense_ratio.toFixed(3) : e.expense_ratio.toFixed(2)}%`
                          : '—'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-[#94A3B8]">AUM</p>
                      <p className="font-semibold text-[#1E293B]">{fmtAum(e.aum)}</p>
                    </div>
                    {e.inception_year && (
                      <div>
                        <p className="text-[#94A3B8]">설정연도</p>
                        <p className="font-semibold text-[#1E293B]">{e.inception_year}년</p>
                      </div>
                    )}
                  </div>

                  {/* AUM 상대 바 */}
                  <AumBar aum={e.aum} maxAum={maxAum} />
                </div>

                {/* 카드 푸터 */}
                <div className="px-4 pb-4">
                  {added ? (
                    <div className="w-full py-2 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold text-center">
                      ✓ 예비 후보함에 추가됨
                    </div>
                  ) : (
                    <button
                      onClick={() => addToWatchlist(e)}
                      disabled={isAdding}
                      className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${
                        isAdding
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-[#1E293B] text-white hover:bg-[#334155] active:scale-95'
                      }`}
                    >
                      {isAdding ? '추가 중…' : '+ 예비 후보함에 추가'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 안내 */}
      <div className="mt-8 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-700 leading-relaxed">
          💡 <strong>ETF 투자 참고사항</strong><br />
          커버드콜 ETF(JEPI·QYLD 등)는 높은 배당률 대신 주가 상승 참여가 제한됩니다.
          배당성장 ETF(SCHD·VIG 등)는 배당률이 낮지만 장기 배당 성장이 기대됩니다.
          리츠·국제 ETF는 세금 처리(배당소득세 15.4% 원천징수)를 별도 확인하세요.
        </p>
      </div>
    </div>
  )
}
