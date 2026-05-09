'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'

// ── 타입 ─────────────────────────────────────────────────────────────────
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
  div_growth_5y: number | null
  div_cut_count: number | null
  total_return_5y: number | null
  top_sector: string | null
  top_sector_pct: number | null
  inWatchlist: boolean
}

// ── 기준 카탈로그 ─────────────────────────────────────────────────────────
const ETF_CRITERIA = [
  {
    key: 'div_yield_min',
    label: '최소 배당률',
    desc: '연간 배당수익률 기준선',
    detail: '배당성장형(SCHD·VIG)은 1~3%대, 고배당형은 3~5%대, 커버드콜은 7~12%대. 높을수록 좋지만 지속 가능성과 함께 봐야 합니다.',
    unit: '%', direction: 'min' as const,
    min: 0, max: 12, step: 0.5, default: 2.0, enabled: true,
    field: 'div_yield',
    goodSign: '안정적인 현금 인컴 확보',
    badSign: '배당 매력 낮음 — 성장주 ETF 특성',
  },
  {
    key: 'expense_ratio_max',
    label: '최대 운용보수',
    desc: '연간 보수 상한선 — 낮을수록 복리 수익률 보존',
    detail: '패시브 ETF(SCHD 0.06%, VIG 0.04%)는 0.1% 미만. 커버드콜·액티브형(JEPI 0.35%, KNG 0.74%)은 높은 보수가 장기 수익률을 잠식합니다.',
    unit: '%', direction: 'max' as const,
    min: 0.01, max: 1.5, step: 0.01, default: 0.50, enabled: true,
    field: 'expense_ratio',
    goodSign: '낮은 보수 — 복리 수익률 온전히 보존',
    badSign: '연 0.5% 이상 — 20년 누적 시 수익률 차이 수십%',
  },
  {
    key: 'aum_min',
    label: '최소 AUM ($B)',
    desc: '운용자산 최소 규모 — 유동성·ETF 존속 안정성',
    detail: '$1B 이상이면 기본 유동성 확보. $10B 이상은 최우량 등급. AUM 부족 ETF는 NAV 괴리율 확대, 청산 위험이 있습니다.',
    unit: 'B', direction: 'min' as const,
    min: 0.1, max: 30, step: 0.1, default: 1.0, enabled: true,
    field: 'aum_b',
    goodSign: '충분한 유동성 — 청산·괴리율 위험 낮음',
    badSign: 'AUM 부족 — 스프레드 확대, 청산 리스크',
  },
  {
    key: 'div_growth_5y_min',
    label: '최소 5Y 배당성장률',
    desc: '배당의 질 — 인플레이션 초과 성장 여부 확인',
    detail: '배당률이 높아도 매년 줄어든다면 실질 가치가 하락합니다. 인플레이션(3%) 초과 성장(5%+)이 장기 인컴 투자의 기준입니다. 커버드콜은 옵션 전략상 성장률이 낮거나 음(-)일 수 있습니다.',
    unit: '%', direction: 'min' as const,
    min: -10, max: 20, step: 0.5, default: 5.0, enabled: false,
    field: 'div_growth_5y',
    goodSign: '배당이 매년 인플레이션 이상으로 성장 — 실질 구매력 유지',
    badSign: '배당 성장 정체·감소 — 실질 인컴이 줄어드는 ETF',
  },
  {
    key: 'total_return_5y_min',
    label: '최소 5Y 총수익 CAGR ★',
    desc: '배당+주가 포함 실제 연복리 — 단일 최강 필터',
    detail: '배당률 10%라도 주가가 연 -5% 하락하면 실질 수익은 5%에 불과합니다. 이 조건 하나만으로 "배당만 높고 성과 안 좋은 ETF"를 대부분 제거할 수 있습니다. 커버드콜 ETF는 옵션 프리미엄 수취 구조상 주가 상승 참여가 제한되어 총수익이 낮은 경향이 있습니다. ≥8% 기준 권장.',
    unit: '%', direction: 'min' as const,
    min: -5, max: 25, step: 0.5, default: 8.0, enabled: true,
    field: 'total_return_5y',
    goodSign: '배당+주가 합산 연복리 8%+ — 원금이 커지며 배당도 받는 구조',
    badSign: '총수익 낮음 — 분배금 함정: 원금이 깎이면서 배당만 주는 ETF',
  },
  {
    key: 'inception_year_max',
    label: '설정 연도 이전',
    desc: '운용 이력 검증 — 실전 시장 사이클 경험',
    detail: '2018년 이전 설정 ETF는 2020년 코로나 충격을 포함한 다양한 시장 국면을 경험했습니다. 신규 ETF는 전략의 실효성이 아직 검증되지 않았습니다.',
    unit: '년', direction: 'max' as const,
    min: 2005, max: 2023, step: 1, default: 2020, enabled: false,
    field: 'inception_year',
    goodSign: '오랜 운용 이력 — 시장 충격 통과 전략 검증',
    badSign: '설정 이력 짧음 — 전략 실효성 미검증',
  },
] as const

type CriteriaKey = typeof ETF_CRITERIA[number]['key']

// ── 투자 목적 프리셋 ──────────────────────────────────────────────────────
interface Preset {
  key: string
  icon: string
  label: string
  sublabel: string
  desc: string
  insight: string
  values: Partial<Record<string, number>>
  activeKeys: string[]
  freqOnly: boolean
  noCutOnly: boolean
  excludeCovered: boolean
  catFilter: string
}

const PRESETS: Preset[] = [
  {
    key: 'growth',
    icon: '🌱',
    label: '장기 자산 증식',
    sublabel: '복리 중심 · 커버드콜 제외',
    desc: '배당률보다 배당 성장 + 주가 상승이 장기 복리를 만듭니다. 총수익 CAGR ≥ 8% 하나만으로 "분배금 함정" ETF 대부분을 제거할 수 있습니다.',
    insight: '장기 복리 = 배당성장 + EPS 성장 + 주가 상승\n배당률 1%p 차이보다 연 성장률 1%p가 20년 후 훨씬 큰 차이를 만듭니다.\n\n월배당 여부는 장기 성과와 거의 무관 → 월배당 강제 OFF\n커버드콜은 강세장에서 지수 대비 뒤처짐 → 제외 권장',
    values: {
      div_yield_min: 1.5,
      expense_ratio_max: 0.30,
      aum_min: 5.0,
      div_growth_5y_min: 5.0,
      total_return_5y_min: 8.0,
      inception_year_max: 2020,
    },
    activeKeys: ['div_yield_min', 'expense_ratio_max', 'aum_min', 'div_growth_5y_min', 'total_return_5y_min', 'inception_year_max'],
    freqOnly: false,
    noCutOnly: true,
    excludeCovered: true,
    catFilter: '전체',
  },
  {
    key: 'income',
    icon: '💸',
    label: '월배당 현금흐름',
    sublabel: '인컴 중심 · JEPI·JEPQ 포함',
    desc: '은퇴 생활비·변동성 완화 목적. 높은 현금 인컴이 우선, 총수익은 차순위입니다. 커버드콜의 주가 상승 제한을 이해하고 활용합니다.',
    insight: '고배당 ≠ 고총수익\n커버드콜은 강세장에서 지수 대비 뒤처집니다. 은퇴 현금흐름·생활비 보조·변동성 완화 목적에 적합합니다.',
    values: {
      div_yield_min: 5.0,
      expense_ratio_max: 0.50,
      aum_min: 1.0,
      div_growth_5y_min: -10,
      total_return_5y_min: -5,
      inception_year_max: 2023,
    },
    activeKeys: ['div_yield_min', 'expense_ratio_max', 'aum_min'],
    freqOnly: true,
    noCutOnly: false,
    excludeCovered: false,
    catFilter: '전체',
  },
  {
    key: 'balanced',
    icon: '⚖️',
    label: '균형형',
    sublabel: '배당 + 성장 밸런스',
    desc: '적절한 배당 인컴을 받으면서 장기 자산 성장도 노립니다. SCHD·VYM·DVY 같은 고품질 고배당 ETF가 중심입니다.',
    insight: '배당 3~5% + 연 배당성장 5~7% = 실질 총수익 8~12%\n배당주 ETF의 가장 전통적인 투자 방식입니다.',
    values: {
      div_yield_min: 3.0,
      expense_ratio_max: 0.45,
      aum_min: 2.0,
      div_growth_5y_min: 3.0,
      total_return_5y_min: 7.0,
      inception_year_max: 2023,
    },
    activeKeys: ['div_yield_min', 'expense_ratio_max', 'aum_min', 'div_growth_5y_min', 'total_return_5y_min'],
    freqOnly: false,
    noCutOnly: false,
    excludeCovered: false,
    catFilter: '전체',
  },
]

// ── 상수 ─────────────────────────────────────────────────────────────────
const CATEGORY_LABEL: Record<string, string> = {
  dividend_growth: '배당성장',
  high_dividend: '고배당',
  covered_call: '커버드콜',
  aristocrat: '귀족·킹',
  reit: '리츠',
  international: '글로벌',
  broad_market: '시장비교',
}
const CATEGORY_COLOR: Record<string, string> = {
  dividend_growth: 'bg-emerald-100 text-emerald-800',
  high_dividend: 'bg-blue-100 text-blue-800',
  covered_call: 'bg-violet-100 text-violet-800',
  aristocrat: 'bg-amber-100 text-amber-800',
  reit: 'bg-orange-100 text-orange-800',
  international: 'bg-sky-100 text-sky-800',
  broad_market: 'bg-gray-100 text-gray-700',
}
const FREQ_LABEL: Record<string, string> = {
  monthly: '월배당', quarterly: '분기', annual: '연배당', unknown: '?',
}
const FREQ_COLOR: Record<string, string> = {
  monthly: 'bg-green-100 text-green-700',
  quarterly: 'bg-blue-100 text-blue-700',
  annual: 'bg-gray-100 text-gray-600',
}

function fmtAum(aum: number | null) {
  if (!aum) return '—'
  if (aum >= 1e9) return `$${(aum / 1e9).toFixed(1)}B`
  return `$${(aum / 1e6).toFixed(0)}M`
}

// ── 기준 카드 ─────────────────────────────────────────────────────────────
function CriteriaCard({ c, value, active, onToggle, onChange }: {
  c: typeof ETF_CRITERIA[number]
  value: number
  active: boolean
  onToggle: (v: boolean) => void
  onChange: (v: number) => void
}) {
  const [open, setOpen] = useState(false)
  const isNeg = c.min < 0

  return (
    <div className={`rounded-xl border p-4 transition-all ${active ? 'border-[#3B82F6] bg-blue-50/30' : 'border-[#E2E8F0] bg-white opacity-60'}`}>
      <div className="flex items-start justify-between mb-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={active} onChange={e => onToggle(e.target.checked)} className="rounded accent-[#3B82F6]" />
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">{c.label}</p>
            <p className="text-xs text-[#64748B] mt-0.5">{c.desc}</p>
          </div>
        </label>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <span className={`text-sm font-bold tabular-nums ${active ? 'text-[#3B82F6]' : 'text-slate-400'}`}>
            {c.direction === 'max' ? '≤' : '≥'}{' '}
            {c.key === 'expense_ratio_max' ? value.toFixed(2) : value}{c.unit}
          </span>
          <button onClick={() => setOpen(o => !o)} className="text-slate-400 hover:text-slate-600 text-xs">{open ? '▲' : '▼'}</button>
        </div>
      </div>
      <input type="range" min={c.min} max={c.max} step={c.step} value={value}
        onChange={e => onChange(Number(e.target.value))} disabled={!active}
        className="w-full h-1.5 rounded-full accent-[#3B82F6] mb-2" />
      {open && (
        <div className="mt-2 pt-3 border-t border-[#E2E8F0] space-y-2">
          <p className="text-xs text-[#475569] leading-relaxed">{c.detail}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-50 rounded-lg p-2">
              <p className="text-xs font-medium text-emerald-700 mb-0.5">✅ 통과 시</p>
              <p className="text-xs text-emerald-600">{c.goodSign}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <p className="text-xs font-medium text-red-700 mb-0.5">❌ 미통과 시</p>
              <p className="text-xs text-red-600">{c.badSign}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 툴팁 컴포넌트 ─────────────────────────────────────────────────────────
function ColTooltip({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center gap-0.5 cursor-help group"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {label}
      <span className="text-[10px] text-slate-400 group-hover:text-blue-500">?</span>
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-[#1E293B] text-white text-xs rounded-xl shadow-xl p-3 w-64 leading-relaxed whitespace-normal text-left">
            {children}
          </div>
          <div className="w-2 h-2 bg-[#1E293B] rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </span>
  )
}

// ── 섹터 집중도 배지 ─────────────────────────────────────────────────────
function ConcentrationBadge({ sector, pct }: { sector: string | null; pct: number | null }) {
  if (!sector || !pct) return <span className="text-slate-300 text-xs">—</span>
  const high = pct >= 50
  const med  = pct >= 30
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
        high ? 'bg-red-100 text-red-700' : med ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
      }`}>
        {sector} {pct.toFixed(0)}%
      </span>
      {high && <span className="text-[9px] text-red-500">⚠ 고집중</span>}
    </div>
  )
}

// ── 평가 함수 ─────────────────────────────────────────────────────────────
function evaluateEtf(
  etf: EtfItem,
  values: Record<string, number>,
  activeKeys: string[],
  freqOnly: boolean,
  noCutOnly: boolean,
) {
  const results: Record<string, boolean | null> = {}
  let passCount = 0; let totalActive = 0

  for (const c of ETF_CRITERIA) {
    if (!activeKeys.includes(c.key)) continue
    totalActive++
    let val: number | null = null
    if (c.field === 'div_yield')      val = etf.div_yield
    else if (c.field === 'expense_ratio') val = etf.expense_ratio
    else if (c.field === 'aum_b')     val = etf.aum ? etf.aum / 1e9 : null
    else if (c.field === 'div_growth_5y')   val = etf.div_growth_5y
    else if (c.field === 'total_return_5y') val = etf.total_return_5y
    else if (c.field === 'inception_year')  val = etf.inception_year
    if (val === null) { results[c.key] = null; continue }
    const pass = c.direction === 'max' ? val <= values[c.key] : val >= values[c.key]
    results[c.key] = pass
    if (pass) passCount++
  }

  const freqPass   = !freqOnly  || etf.div_frequency === 'monthly'
  const cutPass    = !noCutOnly || (etf.div_cut_count ?? 0) === 0
  const overallPass = totalActive > 0 && passCount === totalActive && freqPass && cutPass

  return { results, passCount, totalActive, overallPass, freqPass, cutPass }
}

// ─────────────────────────────────────────────────────────────────────────
export default function EtfScreenerPage() {
  const [etfs, setEtfs]     = useState<EtfItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [addedSet, setAddedSet] = useState<Set<string>>(new Set())
  const [addingTicker, setAddingTicker] = useState<string | null>(null)

  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(ETF_CRITERIA.map(c => [c.key, c.default]))
  )
  const [activeKeys, setActiveKeys] = useState<string[]>(
    ETF_CRITERIA.filter(c => c.enabled).map(c => c.key)
    // 기본 활성: div_yield_min, expense_ratio_max, aum_min, total_return_5y_min
  )
  const [freqOnly,       setFreqOnly]       = useState(false)
  const [noCutOnly,      setNoCutOnly]      = useState(false)
  const [excludeCovered, setExcludeCovered] = useState(false)
  const [showAll,        setShowAll]        = useState(true)
  const [catFilter,      setCatFilter]      = useState('전체')
  const [showGuide,      setShowGuide]      = useState(false)
  const [activePreset,   setActivePreset]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/etf-universe').then(r => r.json()).then(d => {
      if (d.error) { setError(d.error); return }
      setEtfs(d.etfs || [])
      setAddedSet(new Set<string>((d.etfs || []).filter((e: EtfItem) => e.inWatchlist).map((e: EtfItem) => e.ticker)))
    }).catch(e => setError(String(e))).finally(() => setLoading(false))
  }, [])

  const setValue  = useCallback((key: string, v: number) => {
    setValues(p => ({ ...p, [key]: v }))
    setActivePreset(null)  // 수동 변경 시 프리셋 해제
  }, [])
  const toggleKey = useCallback((key: string, on: boolean) => {
    setActiveKeys(p => on ? [...p, key] : p.filter(k => k !== key))
    setActivePreset(null)
  }, [])

  function applyPreset(preset: Preset) {
    setValues(p => ({ ...p, ...(preset.values as Record<string, number>) }))
    setActiveKeys(preset.activeKeys)
    setFreqOnly(preset.freqOnly)
    setNoCutOnly(preset.noCutOnly)
    setExcludeCovered(preset.excludeCovered)
    setCatFilter(preset.catFilter)
    setActivePreset(preset.key)
    setShowAll(true)
  }

  function resetAll() {
    setValues(Object.fromEntries(ETF_CRITERIA.map(c => [c.key, c.default])))
    setActiveKeys(ETF_CRITERIA.filter(c => c.enabled).map(c => c.key))
    setFreqOnly(false)
    setNoCutOnly(false)
    setExcludeCovered(false)
    setCatFilter('전체')
    setActivePreset(null)
  }

  const evaluated = useMemo(() => {
    return etfs
      .filter(e => catFilter === '전체' || e.category === catFilter)
      .filter(e => !excludeCovered || e.category !== 'covered_call')
      .map(e => ({ etf: e, ...evaluateEtf(e, values, activeKeys, freqOnly, noCutOnly) }))
      .sort((a, b) => {
        if (a.overallPass !== b.overallPass) return a.overallPass ? -1 : 1
        if (b.passCount !== a.passCount) return b.passCount - a.passCount
        return (b.etf.div_yield ?? 0) - (a.etf.div_yield ?? 0)
      })
  }, [etfs, values, activeKeys, freqOnly, noCutOnly, catFilter])

  const passedCount = evaluated.filter(e => e.overallPass).length
  const activeC     = ETF_CRITERIA.filter(c => activeKeys.includes(c.key))

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
    } finally { setAddingTicker(null) }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-[#64748B] text-sm">ETF 데이터 로딩 중…</div>
  if (error)   return <div className="p-6 text-red-500 text-sm">오류: {error}</div>

  return (
    <div className="max-w-[1200px] mx-auto p-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">ETF 스크리너</h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            배당 ETF {etfs.length}종 · 배당률·보수·AUM·성장률·총수익 기준 평가
          </p>
        </div>
        <button onClick={() => setShowGuide(g => !g)}
          className="px-3 py-2 border border-[#E2E8F0] text-sm text-[#64748B] rounded-lg hover:bg-slate-50">
          📖 ETF 선택 가이드
        </button>
      </div>

      {/* 투자 목적 프리셋 */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {PRESETS.map(preset => {
          const isActive = activePreset === preset.key
          return (
            <button
              key={preset.key}
              onClick={() => applyPreset(preset)}
              className={`text-left rounded-xl border p-4 transition-all ${
                isActive
                  ? 'border-[#3B82F6] bg-blue-50 ring-2 ring-[#3B82F6]/20'
                  : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl">{preset.icon}</span>
                <div>
                  <p className={`text-sm font-bold leading-tight ${isActive ? 'text-[#3B82F6]' : 'text-[#0F172A]'}`}>{preset.label}</p>
                  <p className="text-[10px] text-[#94A3B8] leading-tight">{preset.sublabel}</p>
                </div>
                {isActive && <span className="ml-auto text-[10px] bg-[#3B82F6] text-white px-1.5 py-0.5 rounded-full shrink-0">적용 중</span>}
              </div>
              <p className="text-xs text-[#64748B] leading-relaxed">{preset.desc}</p>
              {isActive && (
                <div className="mt-2 pt-2 border-t border-blue-100">
                  <p className="text-[10px] text-[#3B82F6] leading-relaxed whitespace-pre-line">{preset.insight}</p>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 초기화 버튼 */}
      <div className="flex justify-end mb-4">
        <button onClick={resetAll}
          className="text-xs text-[#94A3B8] hover:text-[#64748B] px-3 py-1.5 border border-[#E2E8F0] rounded-lg hover:bg-slate-50 transition-colors">
          ↺ 기준 초기화
        </button>
      </div>

      {/* 가이드 */}
      {showGuide && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-amber-900 mb-3">📖 배당 ETF 핵심 선택 기준</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { n: '①', label: '배당률', text: '현재 수익률. 배당성장형 2~3%, 고배당 4~6%, 커버드콜 8~12%.' },
              { n: '②', label: '운용보수', text: '패시브 ETF 0.1% 미만이 이상적. 0.5% 이상은 복리 잠식.' },
              { n: '③', label: 'AUM', text: '$1B 이상이면 기본 안전. $10B 이상 최우량. 소규모 ETF는 청산 위험.' },
              { n: '④', label: '5Y 배당성장률', text: '인플레(3%) 초과 성장(5%+)이 실질 인컴 유지의 기준.' },
              { n: '⑤', label: '총수익 CAGR', text: '배당 10% + 주가 -5% = 실질 5%. 총수익이 진짜 성과.' },
              { n: '⑥', label: '섹터 집중도', text: '리츠/에너지/기술 등 한 섹터 50% 이상이면 집중 리스크.' },
            ].map(item => (
              <div key={item.n} className="flex gap-2">
                <span className="text-amber-700 font-bold shrink-0">{item.n}</span>
                <div>
                  <p className="font-semibold text-amber-900">{item.label}</p>
                  <p className="text-amber-700 mt-0.5">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-amber-200 text-xs text-amber-800">
            ⚡ <strong>커버드콜 ETF 주의:</strong> 높은 배당은 옵션 프리미엄 수취. 주가 상승 참여 제한 → 5Y 총수익이 낮은 경향. 현금흐름 목적에 적합, 장기 자산 성장 목적엔 부적합.
          </div>
        </div>
      )}

      {/* 카테고리 탭 */}
      <div className="flex gap-1 mb-5 flex-wrap">
        {['전체', ...Object.keys(CATEGORY_LABEL)].map(cat => (
          <button key={cat} onClick={() => setCatFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              catFilter === cat ? 'bg-[#1E293B] text-white' : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
            }`}>
            {cat === '전체' ? '전체' : CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>

      {/* 기준 카드 그리드 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {ETF_CRITERIA.map(c => (
          <CriteriaCard key={c.key} c={c}
            value={values[c.key] ?? c.default}
            active={activeKeys.includes(c.key)}
            onToggle={on => toggleKey(c.key, on)}
            onChange={v => setValue(c.key, v)} />
        ))}
      </div>

      {/* 추가 Boolean 필터 */}
      <div className="flex items-center gap-6 mb-6 px-4 py-3 bg-white rounded-xl border border-[#E2E8F0] text-sm flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={freqOnly}
            onChange={e => { setFreqOnly(e.target.checked); setActivePreset(null) }}
            className="rounded accent-[#3B82F6]" />
          <span className="font-medium text-[#0F172A]">월배당만</span>
          <span className="text-xs text-[#94A3B8]">JEPI·QYLD·DGRW</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={noCutOnly}
            onChange={e => { setNoCutOnly(e.target.checked); setActivePreset(null) }}
            className="rounded accent-[#3B82F6]" />
          <span className="font-medium text-[#0F172A]">감배 없음</span>
          <span className="text-xs text-[#94A3B8]">최근 5년 감배 0회</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={excludeCovered}
            onChange={e => { setExcludeCovered(e.target.checked); setActivePreset(null) }}
            className="rounded accent-[#3B82F6]" />
          <span className="font-medium text-[#0F172A]">커버드콜 제외</span>
          <span className="text-xs text-[#94A3B8]">장기 자산 증식 시 추천</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-[#64748B] cursor-pointer ml-auto">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="rounded" />
          미통과 포함
        </label>
      </div>

      {/* 결과 카운트 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-[#0F172A]">
          스크리닝 결과 — <span className="text-[#3B82F6]">{passedCount}</span>/{evaluated.length} 통과
        </h2>
        <div className="flex items-center gap-3 text-xs text-[#64748B]">
          <span>✅ 통과</span><span>❌ 미통과</span><span className="text-slate-400">— 데이터 없음</span>
        </div>
      </div>

      {/* 결과 테이블 */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-auto max-h-[700px]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-[#E2E8F0] sticky top-0 z-20">
              <th className="text-left px-4 py-3 font-medium text-[#64748B] sticky left-0 bg-slate-50 z-30 border-r border-[#E2E8F0]">티커</th>
              <th className="text-left px-3 py-3 font-medium text-[#64748B] text-xs min-w-[130px]">ETF명</th>
              <th className="text-center px-2 py-3 font-medium text-[#64748B] text-xs">카테고리</th>
              <th className="text-right px-2 py-3 font-medium text-[#64748B] text-xs">
                <ColTooltip label="배당률">
                  <strong>배당률 (Dividend Yield)</strong><br/>
                  현재 주가 대비 연간 배당금 비율입니다.<br/><br/>
                  • 배당성장형(SCHD·VIG): 1~3%<br/>
                  • 고배당형(VYM·DVY): 3~5%<br/>
                  • 커버드콜(JEPI·QYLD): 7~12%<br/><br/>
                  <span className="text-yellow-300">⚠ 높을수록 좋지만 지속 가능성과 함께 봐야 합니다.</span>
                </ColTooltip>
              </th>
              <th className="text-right px-2 py-3 font-medium text-[#64748B] text-xs">
                <ColTooltip label="보수">
                  <strong>운용보수 (Expense Ratio)</strong><br/>
                  ETF 운용사가 매년 자동 차감하는 수수료입니다.<br/><br/>
                  • 패시브 ETF(SCHD·VIG): 0.1% 미만<br/>
                  • 액티브·커버드콜(JEPI): 0.35%<br/>
                  • 고비용(KNG): 0.7% 이상<br/><br/>
                  <span className="text-yellow-300">⚠ 0.5% 차이가 20년 뒤 수익률을 수십% 바꿉니다.</span>
                </ColTooltip>
              </th>
              <th className="text-right px-2 py-3 font-medium text-[#64748B] text-xs">
                <ColTooltip label="AUM">
                  <strong>AUM (운용자산 규모)</strong><br/>
                  Assets Under Management. ETF에 투자된 총 금액입니다.<br/><br/>
                  • $1B 이상: 기본 유동성 확보<br/>
                  • $10B 이상: 최우량 등급<br/><br/>
                  <span className="text-yellow-300">⚠ AUM 부족 ETF는 NAV 괴리율 확대, 청산 위험이 있습니다.</span>
                </ColTooltip>
              </th>
              <th className="text-right px-2 py-3 font-medium text-[#64748B] text-xs">
                <ColTooltip label="배당성장↑">
                  <strong>5년 배당성장률 CAGR</strong><br/>
                  최근 5개 완성연도 기준 연간 배당금 복리 성장률입니다. (현재 연도 제외)<br/><br/>
                  인플레이션(3%)을 초과하는 성장(5%+)이 장기 인컴 투자의 기준입니다.<br/><br/>
                  • ≥7%: 우수 (초록)<br/>
                  • 3~7%: 양호 (파랑)<br/>
                  • 0~3%: 보통 (회색)<br/>
                  • 음수: 배당 감소 추세 (빨강)<br/><br/>
                  <span className="text-yellow-300">커버드콜 ETF는 옵션 구조상 성장률이 낮거나 음(-)일 수 있습니다.</span>
                </ColTooltip>
              </th>
              <th className="text-right px-2 py-3 font-medium text-[#64748B] text-xs">
                <ColTooltip label="총수익↑">
                  <strong>5년 총수익 CAGR ★</strong><br/>
                  주가 상승 + 배당금 재투자를 합산한 연복리 수익률입니다.<br/><br/>
                  배당률만 보면 안 되는 이유: 배당 10% + 주가 -5% = 실질 수익 5%에 불과합니다.<br/><br/>
                  • ≥10%: 우수 (초록)<br/>
                  • 5~10%: 양호 (파랑)<br/>
                  • &lt;5%: 주의 (빨강)<br/><br/>
                  <span className="text-yellow-300">⭐ 단일 최강 필터 — 이 항목 하나로 분배금 함정 ETF 대부분 제거 가능</span>
                </ColTooltip>
              </th>
              <th className="text-center px-2 py-3 font-medium text-[#64748B] text-xs">
                <ColTooltip label="주기">
                  <strong>배당 지급 주기</strong><br/>
                  • 월배당: 매월 지급 (JEPI·QYLD·JEPQ)<br/>
                  • 분기: 3개월마다 지급 (SCHD·VIG·VYM)<br/>
                  • 연배당: 연 1회 지급<br/><br/>
                  현금흐름이 필요하면 월배당, 장기 복리 목적이면 주기는 성과에 영향 없습니다.
                </ColTooltip>
              </th>
              <th className="text-center px-2 py-3 font-medium text-[#64748B] text-xs">
                <ColTooltip label="감배">
                  <strong>감배 횟수 (Dividend Cut)</strong><br/>
                  배당 삭감을 뜻합니다. 최근 5개 완성연도 중 연간 배당 총액이 전년 대비 5% 이상 감소한 횟수입니다.<br/><br/>
                  • 없음: 배당 안정적 유지 (초록)<br/>
                  • 1~2회: 주의 필요 (빨강)<br/><br/>
                  <span className="text-yellow-300">⚠ 감배는 ETF 내 기업들의 배당 건전성 악화 신호입니다. "감배 없음" 필터로 안정적인 ETF만 추릴 수 있습니다.</span>
                </ColTooltip>
              </th>
              <th className="text-center px-2 py-3 font-medium text-[#64748B] text-xs">
                <ColTooltip label="섹터집중">
                  <strong>섹터 집중도 (Top Sector)</strong><br/>
                  ETF 내 가장 높은 비중을 차지하는 단일 섹터와 그 비율입니다.<br/><br/>
                  • 빨강(⚠ 고집중): 단일 섹터 50% 이상<br/>
                  • 주황: 30~50%<br/>
                  • 회색: 30% 미만 (분산 양호)<br/><br/>
                  리츠 ETF(VNQ)는 리츠 100%, 에너지 ETF는 에너지 집중이 당연합니다. 종합 배당 ETF에서 고집중이면 섹터 리스크에 주의하세요.
                </ColTooltip>
              </th>
              {activeC.map(c => (
                <th key={c.key} className="text-center px-2 py-3 font-medium text-[#64748B] text-xs min-w-[52px]">{c.label}</th>
              ))}
              <th className="text-center px-2 py-3 font-medium text-[#64748B] text-xs min-w-[72px]">결과</th>
              <th className="text-center px-2 py-3 font-medium text-[#64748B] text-xs">후보함</th>
            </tr>
          </thead>
          <tbody>
            {evaluated.filter(r => showAll || r.overallPass).map(({ etf, results, overallPass, passCount, totalActive }, i) => {
              const rowBg = overallPass ? 'bg-emerald-50/60' : i % 2 ? 'bg-slate-50/30' : 'bg-white'
              const added = addedSet.has(etf.ticker)

              return (
                <tr key={etf.ticker} className={`border-b border-[#E2E8F0] last:border-0 ${rowBg}`}>
                  {/* 티커 */}
                  <td className={`px-4 py-3 font-bold sticky left-0 z-10 border-r border-[#E2E8F0] ${rowBg}`}>
                    <span className="text-[#3B82F6]">{etf.ticker}</span>
                    {overallPass && <span className="ml-1 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">통과</span>}
                  </td>
                  {/* ETF명 */}
                  <td className="px-3 py-3 text-xs text-[#0F172A]" title={etf.description ?? ''}>
                    <span className="line-clamp-1">{etf.name}</span>
                  </td>
                  {/* 카테고리 */}
                  <td className="px-2 py-3 text-center">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CATEGORY_COLOR[etf.category] ?? ''}`}>
                      {CATEGORY_LABEL[etf.category]}
                    </span>
                  </td>
                  {/* 배당률 */}
                  <td className="px-2 py-3 text-right tabular-nums text-xs">
                    {etf.div_yield !== null
                      ? <span className={`font-semibold ${etf.div_yield >= 5 ? 'text-emerald-600' : etf.div_yield >= 3 ? 'text-blue-600' : 'text-[#64748B]'}`}>{etf.div_yield.toFixed(2)}%</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  {/* 보수 */}
                  <td className="px-2 py-3 text-right tabular-nums text-xs">
                    {etf.expense_ratio !== null
                      ? <span className={`font-semibold ${etf.expense_ratio <= 0.1 ? 'text-emerald-600' : etf.expense_ratio <= 0.4 ? 'text-[#64748B]' : 'text-red-500'}`}>
                          {etf.expense_ratio < 0.01 ? etf.expense_ratio.toFixed(3) : etf.expense_ratio.toFixed(2)}%
                        </span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  {/* AUM */}
                  <td className="px-2 py-3 text-right tabular-nums text-xs">
                    <span className={`font-medium ${(etf.aum ?? 0) >= 10e9 ? 'text-emerald-600' : (etf.aum ?? 0) >= 1e9 ? 'text-[#64748B]' : 'text-red-400'}`}>{fmtAum(etf.aum)}</span>
                  </td>
                  {/* 5Y 배당성장률 */}
                  <td className="px-2 py-3 text-right tabular-nums text-xs">
                    {etf.div_growth_5y !== null
                      ? <span className={`font-semibold ${etf.div_growth_5y >= 7 ? 'text-emerald-600' : etf.div_growth_5y >= 3 ? 'text-blue-600' : etf.div_growth_5y >= 0 ? 'text-[#64748B]' : 'text-red-500'}`}>
                          {etf.div_growth_5y >= 0 ? '+' : ''}{etf.div_growth_5y.toFixed(1)}%
                        </span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  {/* 총수익 5Y CAGR */}
                  <td className="px-2 py-3 text-right tabular-nums text-xs">
                    {etf.total_return_5y !== null
                      ? <span className={`font-semibold ${etf.total_return_5y >= 10 ? 'text-emerald-600' : etf.total_return_5y >= 5 ? 'text-blue-600' : 'text-red-500'}`}>
                          {etf.total_return_5y >= 0 ? '+' : ''}{etf.total_return_5y.toFixed(1)}%
                        </span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  {/* 배당주기 */}
                  <td className="px-2 py-3 text-center">
                    {etf.div_frequency
                      ? <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${FREQ_COLOR[etf.div_frequency] ?? ''}`}>{FREQ_LABEL[etf.div_frequency] ?? etf.div_frequency}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  {/* 감배 횟수 */}
                  <td className="px-2 py-3 text-center text-xs">
                    {etf.div_cut_count !== null
                      ? etf.div_cut_count === 0
                        ? <span className="text-emerald-600 font-semibold">없음</span>
                        : <span className="text-red-500 font-semibold">{etf.div_cut_count}회</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  {/* 섹터 집중도 */}
                  <td className="px-2 py-3 text-center">
                    <ConcentrationBadge sector={etf.top_sector} pct={etf.top_sector_pct} />
                  </td>
                  {/* 기준별 pass/fail */}
                  {activeC.map(c => {
                    const pass = results[c.key]
                    return (
                      <td key={c.key} className="px-2 py-3 text-center text-sm">
                        {pass === null ? <span className="text-slate-300 text-xs">—</span> : pass ? '✅' : '❌'}
                      </td>
                    )
                  })}
                  {/* 종합 결과 */}
                  <td className="px-2 py-3 text-center">
                    {activeC.length === 0
                      ? <span className="text-slate-400 text-xs">기준 없음</span>
                      : overallPass
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">✅ 통과</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs">{passCount}/{totalActive}</span>}
                  </td>
                  {/* 후보함 */}
                  <td className="px-2 py-3 text-center">
                    {added
                      ? <span className="text-emerald-600 text-xs">✓</span>
                      : <button onClick={() => addToWatchlist(etf)} disabled={addingTicker === etf.ticker}
                          className="text-xs px-2 py-0.5 border border-[#3B82F6] text-[#3B82F6] rounded hover:bg-blue-50 disabled:opacity-50">+</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {evaluated.filter(r => showAll || r.overallPass).length === 0 && (
          <div className="text-center py-12 text-[#94A3B8]">
            <p className="text-sm">기준을 통과한 ETF가 없습니다</p>
            <p className="text-xs mt-1">기준값을 완화하거나 일부 기준을 비활성화해 보세요</p>
          </div>
        )}
      </div>

      {/* 안내 */}
      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <p className="text-xs text-blue-700 leading-relaxed">
          💡 <strong>스크리닝 활용법:</strong>{' '}
          기본 활성화된 3개 기준(배당률·보수·AUM) 외 <strong>5Y 배당성장률</strong>·<strong>총수익 CAGR</strong>을 추가로 켜면 배당의 질과 실질 성과를 함께 평가할 수 있습니다.
          <strong>섹터집중</strong> 열에서 빨간 배지(⚠ 고집중)는 해당 섹터 리스크에 주의하세요.
          ▼를 눌러 각 기준의 상세 해설을 확인하세요.
        </p>
      </div>
    </div>
  )
}
