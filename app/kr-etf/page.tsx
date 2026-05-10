'use client'

import { useEffect, useState, useMemo } from 'react'

interface KrEtf {
  ticker: string
  name: string
  issuer: string | null
  us_equiv: string | null
  index_name: string | null
  div_yield: number | null
  expense_ratio: number | null
  aum_krw: number | null
  div_frequency: string | null
  hedged: boolean
  isa_eligible: boolean
  pension_eligible: boolean
  inception_year: number | null
  tracking_diff: number | null
  description: string | null
  inWatchlist: boolean
}

// ── 보수·배당률 보완 (yfinance KRX 미지원 → 수동 입력) ─────────────────────
const KR_MANUAL: Record<string, { expense: number; yield_pct?: number; aum_100m?: number }> = {
  '458730': { expense: 0.09,  yield_pct: 3.2,  aum_100m: 18000 }, // KODEX 미국배당다우존스
  '458760': { expense: 0.09,  yield_pct: 3.1,  aum_100m: 9000  }, // TIGER 미국배당다우존스
  '429000': { expense: 0.09,  yield_pct: 1.8,  aum_100m: 3000  }, // KODEX S&P500배당귀족
  '429050': { expense: 0.09,  yield_pct: 1.8,  aum_100m: 1500  }, // TIGER S&P500배당귀족
  '469100': { expense: 0.35,  yield_pct: 7.5,  aum_100m: 5000  }, // KODEX 미국배당프리미엄액티브
  '476550': { expense: 0.39,  yield_pct: 7.0,  aum_100m: 8000  }, // TIGER 미국배당+7%프리미엄
  '437080': { expense: 0.30,  yield_pct: 10.5, aum_100m: 2500  }, // TIGER 나스닥100커버드콜
  '133690': { expense: 0.07,  yield_pct: 0.5,  aum_100m: 45000 }, // TIGER 미국나스닥100
  '379800': { expense: 0.05,  yield_pct: 0.4,  aum_100m: 25000 }, // KODEX 나스닥100TR
  '360750': { expense: 0.07,  yield_pct: 1.2,  aum_100m: 60000 }, // TIGER 미국S&P500
  '379810': { expense: 0.05,  yield_pct: 1.2,  aum_100m: 20000 }, // KODEX 미국S&P500
  '251340': { expense: 0.09,  yield_pct: 1.1,  aum_100m: 3000  }, // TIGER 미국전체주식시장
  '352560': { expense: 0.09,  yield_pct: 3.8,  aum_100m: 2000  }, // KODEX 미국리츠
  '492580': { expense: 0.09,  yield_pct: 2.8,  aum_100m: 1000  }, // TIGER 미국고배당
}

// ── 미국 ETF 대비 총보수 차이 (국내 - 미국, 대략 계산용) ─────────────────
const US_EXPENSE: Record<string, number> = {
  'SCHD': 0.06, 'NOBL': 0.35, 'JEPI': 0.35, 'QYLD': 0.60,
  'QQQ': 0.20, 'QQQM': 0.15, 'VOO': 0.03, 'IVV': 0.03,
  'VTI': 0.03, 'VNQ': 0.12, 'VYM': 0.06,
}

const FREQ_LABEL: Record<string, string> = {
  monthly: '월배당', quarterly: '분기', annual: '연배당', unknown: '?',
}
const FREQ_COLOR: Record<string, string> = {
  monthly: 'bg-green-100 text-green-700',
  quarterly: 'bg-blue-100 text-blue-700',
  annual: 'bg-gray-100 text-gray-600',
}
const ISSUER_COLOR: Record<string, string> = {
  'KODEX': 'bg-blue-100 text-blue-700',
  'TIGER': 'bg-orange-100 text-orange-700',
  'KINDEX': 'bg-purple-100 text-purple-700',
}

function fmtAum(aum_100m: number | undefined) {
  if (!aum_100m) return '—'
  if (aum_100m >= 10000) return `${(aum_100m / 10000).toFixed(1)}조`
  return `${aum_100m.toLocaleString()}억`
}

function ExpenseDiff({ krExpense, usEquiv }: { krExpense: number; usEquiv: string | null }) {
  if (!usEquiv || !US_EXPENSE[usEquiv]) return null
  const diff = krExpense - US_EXPENSE[usEquiv]
  if (Math.abs(diff) < 0.01) return null
  return (
    <span className={`text-[9px] ml-1 ${diff > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
      ({diff > 0 ? '+' : ''}{diff.toFixed(2)}%)
    </span>
  )
}

type FilterTab = '전체' | 'KODEX' | 'TIGER' | '절세계좌'
type SortKey = 'name' | 'expense' | 'yield' | 'aum'

export default function KrEtfPage() {
  const [etfs, setEtfs] = useState<KrEtf[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<FilterTab>('전체')
  const [sort, setSort] = useState<SortKey>('aum')
  const [addedSet, setAddedSet] = useState<Set<string>>(new Set())
  const [addingTicker, setAddingTicker] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/kr-etf')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setEtfs(d.etfs || [])
        setAddedSet(new Set((d.etfs || []).filter((e: KrEtf) => e.inWatchlist).map((e: KrEtf) => e.ticker)))
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  // 수동 데이터 병합
  const merged = useMemo(() => etfs.map(e => {
    const m = KR_MANUAL[e.ticker]
    return {
      ...e,
      expense_ratio: m?.expense ?? e.expense_ratio,
      div_yield: m?.yield_pct ?? e.div_yield,
      aum_krw: m?.aum_100m ?? e.aum_krw,
    }
  }), [etfs])

  const filtered = useMemo(() => {
    let list = merged
    if (tab === 'KODEX') list = list.filter(e => e.issuer === 'KODEX')
    else if (tab === 'TIGER') list = list.filter(e => e.issuer === 'TIGER')
    else if (tab === '절세계좌') list = list.filter(e => e.isa_eligible || e.pension_eligible)

    return [...list].sort((a, b) => {
      if (sort === 'expense') return (a.expense_ratio ?? 99) - (b.expense_ratio ?? 99)
      if (sort === 'yield') return (b.div_yield ?? 0) - (a.div_yield ?? 0)
      if (sort === 'aum') return (b.aum_krw ?? 0) - (a.aum_krw ?? 0)
      return (a.name ?? '').localeCompare(b.name ?? '', 'ko')
    })
  }, [merged, tab, sort])

  async function addToWatchlist(e: KrEtf) {
    if (addingTicker) return
    setAddingTicker(e.ticker)
    try {
      const res = await fetch('/api/etf-universe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: e.ticker, name: e.name, asset_type: 'kr_etf' }),
      })
      if (res.ok) setAddedSet(prev => new Set([...prev, e.ticker]))
    } finally { setAddingTicker(null) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#64748B]">
      <div className="text-center"><div className="text-2xl mb-2">🇰🇷</div><p className="text-sm">국내 ETF 로딩 중…</p></div>
    </div>
  )
  if (error) return <div className="p-6 text-red-500 text-sm">오류: {error}</div>

  const totalEtfs = merged.length
  const kodexCount = merged.filter(e => e.issuer === 'KODEX').length
  const tigerCount = merged.filter(e => e.issuer === 'TIGER').length
  const monthlyCount = merged.filter(e => e.div_frequency === 'monthly').length

  return (
    <div className="max-w-[1100px] mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
          🇰🇷 국내 상장 ETF
        </h1>
        <p className="text-sm text-[#64748B] mt-1">
          미국 배당 ETF의 국내 대응 종목 · 원화 매매 · ISA·연금저축 절세 계좌 활용 가능
        </p>
      </div>

      {/* 안내 배너 */}
      <div className="mb-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
        <div className="grid grid-cols-2 gap-4 text-xs text-blue-800">
          <div>
            <p className="font-semibold mb-1">✅ 국내 ETF의 장점</p>
            <ul className="space-y-0.5 text-blue-700">
              <li>• 원화 직접 매매 — 환전·해외 계좌 불필요</li>
              <li>• ISA·연금저축에서 배당소득세 절세</li>
              <li>• 국내 증권사 HTS/MTS에서 즉시 거래</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-1">⚠️ 미국 원본 대비 유의점</p>
            <ul className="space-y-0.5 text-blue-700">
              <li>• 총보수가 미국 원본보다 높은 경우 多</li>
              <li>• AUM·유동성이 미국보다 작음</li>
              <li>• 트래킹 에러 발생 가능</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: '총 종목', value: `${totalEtfs}개` },
          { label: 'KODEX', value: `${kodexCount}개` },
          { label: 'TIGER', value: `${tigerCount}개` },
          { label: '월배당', value: `${monthlyCount}개` },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 text-center">
            <p className="text-xl font-bold text-[#0F172A]">{item.value}</p>
            <p className="text-xs text-[#64748B] mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {/* 탭 + 정렬 */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex gap-1">
          {(['전체', 'KODEX', 'TIGER', '절세계좌'] as FilterTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-[#1E293B] text-white' : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-slate-50'
              }`}>
              {t === '절세계좌' ? '🏦 절세계좌 적합' : t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-[#64748B]">
          <span>정렬:</span>
          {([['aum', 'AUM 순'], ['expense', '보수 낮은순'], ['yield', '배당률 높은순'], ['name', '이름순']] as [SortKey, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setSort(k)}
              className={`px-2 py-1 rounded ${sort === k ? 'bg-[#1E293B] text-white' : 'bg-white border border-[#E2E8F0] hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-[#E2E8F0]">
              <th className="text-left px-4 py-3 font-medium text-[#64748B] text-xs whitespace-nowrap">종목명</th>
              <th className="text-center px-3 py-3 font-medium text-[#64748B] text-xs whitespace-nowrap">운용사</th>
              <th className="text-center px-3 py-3 font-medium text-[#64748B] text-xs whitespace-nowrap">미국 원본</th>
              <th className="text-right px-3 py-3 font-medium text-[#64748B] text-xs whitespace-nowrap">배당률</th>
              <th className="text-right px-3 py-3 font-medium text-[#64748B] text-xs whitespace-nowrap">총보수</th>
              <th className="text-right px-3 py-3 font-medium text-[#64748B] text-xs whitespace-nowrap">순자산</th>
              <th className="text-center px-3 py-3 font-medium text-[#64748B] text-xs whitespace-nowrap">주기</th>
              <th className="text-center px-3 py-3 font-medium text-[#64748B] text-xs whitespace-nowrap">ISA</th>
              <th className="text-center px-3 py-3 font-medium text-[#64748B] text-xs whitespace-nowrap">연금</th>
              <th className="text-center px-3 py-3 font-medium text-[#64748B] text-xs whitespace-nowrap">환헤지</th>
              <th className="text-center px-3 py-3 font-medium text-[#64748B] text-xs whitespace-nowrap">후보함</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => {
              const manual = KR_MANUAL[e.ticker]
              const added = addedSet.has(e.ticker)
              const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
              return (
                <tr key={e.ticker} className={`border-b border-[#E2E8F0] last:border-0 ${rowBg} hover:bg-blue-50/30 transition-colors`}>
                  {/* 종목명 */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-[#0F172A] text-sm">{e.name}</span>
                      <span className="text-[10px] text-[#94A3B8]">{e.ticker} · {e.index_name ?? '—'}</span>
                      {e.description && <span className="text-[10px] text-[#64748B] line-clamp-1">{e.description}</span>}
                    </div>
                  </td>
                  {/* 운용사 */}
                  <td className="px-3 py-3 text-center">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${ISSUER_COLOR[e.issuer ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                      {e.issuer ?? '—'}
                    </span>
                  </td>
                  {/* 미국 원본 */}
                  <td className="px-3 py-3 text-center">
                    {e.us_equiv
                      ? <span className="text-xs font-bold text-[#3B82F6] bg-blue-50 px-2 py-0.5 rounded whitespace-nowrap">{e.us_equiv}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  {/* 배당률 */}
                  <td className="px-3 py-3 text-right tabular-nums text-xs">
                    {e.div_yield !== null
                      ? <span className={`font-semibold ${e.div_yield >= 5 ? 'text-emerald-600' : e.div_yield >= 2 ? 'text-blue-600' : 'text-[#64748B]'}`}>
                          {e.div_yield.toFixed(1)}%
                        </span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  {/* 총보수 */}
                  <td className="px-3 py-3 text-right tabular-nums text-xs whitespace-nowrap">
                    {e.expense_ratio !== null
                      ? <>
                          <span className={`font-semibold ${e.expense_ratio <= 0.1 ? 'text-emerald-600' : e.expense_ratio <= 0.4 ? 'text-[#64748B]' : 'text-red-500'}`}>
                            {e.expense_ratio.toFixed(2)}%
                          </span>
                          <ExpenseDiff krExpense={e.expense_ratio} usEquiv={e.us_equiv} />
                        </>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  {/* 순자산 */}
                  <td className="px-3 py-3 text-right tabular-nums text-xs">
                    {e.aum_krw !== null
                      ? <span className={`font-medium ${e.aum_krw >= 10000 ? 'text-emerald-600' : e.aum_krw >= 3000 ? 'text-[#64748B]' : 'text-amber-600'}`}>
                          {fmtAum(e.aum_krw)}
                        </span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  {/* 배당주기 */}
                  <td className="px-3 py-3 text-center">
                    {e.div_frequency && e.div_frequency !== 'unknown'
                      ? <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${FREQ_COLOR[e.div_frequency] ?? ''}`}>
                          {FREQ_LABEL[e.div_frequency]}
                        </span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  {/* ISA */}
                  <td className="px-3 py-3 text-center text-sm">
                    {e.isa_eligible ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  {/* 연금 */}
                  <td className="px-3 py-3 text-center text-sm">
                    {e.pension_eligible ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  {/* 환헤지 */}
                  <td className="px-3 py-3 text-center text-xs">
                    {e.hedged
                      ? <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">H형</span>
                      : <span className="text-slate-400 text-[10px]">무헤지</span>}
                  </td>
                  {/* 후보함 */}
                  <td className="px-3 py-3 text-center">
                    {added
                      ? <span className="text-emerald-600 text-xs">✓</span>
                      : <button onClick={() => addToWatchlist(e)} disabled={addingTicker === e.ticker}
                          className="text-xs px-2 py-0.5 border border-[#3B82F6] text-[#3B82F6] rounded hover:bg-blue-50 disabled:opacity-50">+</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[#94A3B8] text-sm">표시할 종목이 없습니다</div>
        )}
      </div>

      {/* 안내 */}
      <div className="mt-4 text-xs text-[#94A3B8] leading-relaxed">
        <p>※ 배당률·순자산은 참고용 수동 입력값입니다. 총보수 괄호 안의 +/- 수치는 미국 원본 ETF 대비 보수 차이입니다.</p>
        <p>※ ISA·연금저축 계좌에서 매수 시 배당소득세(15.4%) 절세 효과가 있습니다. 계좌 개설 후 증권사에서 확인하세요.</p>
      </div>
    </div>
  )
}
