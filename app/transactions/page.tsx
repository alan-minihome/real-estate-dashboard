'use client'
import { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const ASSET_TYPES = [
  { value: 'apartment', label: '아파트' },
  { value: 'officetel', label: '오피스텔' },
  { value: 'villa', label: '연립다세대' },
  { value: 'single-house', label: '단독/다가구' },
  { value: 'commercial', label: '상업업무용' },
]
const DEAL_TYPES = [
  { value: 'trade', label: '매매' },
  { value: 'rent', label: '전월세' },
]

type RegionResult = { lawd_cd: string; name: string }
type TxItem = {
  name: string; district: string; area_m2: number; floor: number
  price_10k?: number; deposit_10k?: number; monthly_rent_10k?: number
  deal_date: string; build_year?: number; contract_type?: string
}
type TxResult = {
  items: TxItem[]
  summary: { median_price_10k?: number; min_price_10k?: number; max_price_10k?: number; sample_count: number; median_deposit_10k?: number; monthly_rent_avg_10k?: number }
  query: { asset_type: string; deal_type: string; lawd_cd: string; deal_ymd: string }
}
type HistoryItem = { regionName: string; lawdCd: string; assetType: string; dealType: string; months: string[]; ts: number }

function fmt(val: number | undefined) {
  if (!val) return '-'
  if (val >= 10000) return `${(val / 10000).toFixed(1)}억`
  return `${val.toLocaleString()}만`
}

function currentYm() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
}
function currentYmInput() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function ymToDisplay(ym: string) {
  return `${ym.slice(0, 4)}년 ${ym.slice(4)}월`
}
function recentMonths(n: number): string[] {
  const result: string[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

export default function TransactionsPage() {
  const [regionQ, setRegionQ] = useState('')
  const [regions, setRegions] = useState<RegionResult[]>([])
  const [selectedRegion, setSelectedRegion] = useState<RegionResult | null>(null)
  const [assetType, setAssetType] = useState('apartment')
  const [dealType, setDealType] = useState('trade')
  const [months, setMonths] = useState<string[]>([currentYm()])
  const [result, setResult] = useState<TxResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const monthInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('tx-history') ?? '[]')
      setHistory(saved)
    } catch { /* ignore */ }
  }, [])

  const saveHistory = (regionName: string, lawdCd: string, at: string, dt: string, ms: string[]) => {
    const item: HistoryItem = { regionName, lawdCd, assetType: at, dealType: dt, months: ms, ts: Date.now() }
    const next = [item, ...history.filter(h => !(h.lawdCd === lawdCd && h.assetType === at && h.dealType === dt))].slice(0, 6)
    setHistory(next)
    localStorage.setItem('tx-history', JSON.stringify(next))
  }

  const fetchTx = async (region: RegionResult, at: string, dt: string, ms: string[]) => {
    if (!region || ms.length === 0) return
    setLoading(true); setError(''); setResult(null)
    try {
      const results = await Promise.all(
        ms.map(m => fetch(`/api/transactions?lawdCd=${region.lawd_cd}&dealYmd=${m}&assetType=${at}&dealType=${dt}`).then(r => r.json()))
      )
      const merged = results.find(r => !r.error) ?? results[0]
      if (merged.error) setError(merged.error)
      else {
        // 여러 달 조회 시 items 합산
        if (ms.length > 1) {
          const allItems = results.flatMap(r => r.items ?? [])
          setResult({ ...merged, items: allItems, summary: { ...merged.summary, sample_count: allItems.length } })
        } else {
          setResult(merged)
        }
        saveHistory(region.name, region.lawd_cd, at, dt, ms)
      }
    } catch {
      setError('조회 실패')
    } finally {
      setLoading(false)
    }
  }

  const searchRegion = async (q?: string) => {
    const query = q ?? regionQ
    if (!query.trim()) return
    setSearching(true); setRegions([]); setSelectedRegion(null); setResult(null)
    try {
      const res = await fetch(`/api/transactions?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      const results: RegionResult[] = data.results ?? []
      setRegions(results)
      // 결과가 1개면 자동 선택 후 즉시 조회
      if (results.length === 1) {
        setSelectedRegion(results[0])
        await fetchTx(results[0], assetType, dealType, months)
      }
    } finally {
      setSearching(false)
    }
  }

  const selectRegion = async (r: RegionResult) => {
    setSelectedRegion(r)
    setRegions([])
    await fetchTx(r, assetType, dealType, months)
  }

  const restoreHistory = async (h: HistoryItem) => {
    setRegionQ(h.regionName)
    setAssetType(h.assetType)
    setDealType(h.dealType)
    setMonths(h.months)
    const region = { lawd_cd: h.lawdCd, name: h.regionName }
    setSelectedRegion(region)
    await fetchTx(region, h.assetType, h.dealType, h.months)
  }

  const addMonth = (ym: string) => {
    if (!months.includes(ym)) setMonths(prev => [...prev, ym].sort((a, b) => b.localeCompare(a)))
  }

  const isCommercialRent = assetType === 'commercial' && dealType === 'rent'

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">실거래가 조회</h1>

      {/* 검색 기록 */}
      {history.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">최근 검색</p>
          <div className="flex flex-wrap gap-2">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => restoreHistory(h)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                <span>🕐</span>
                <span>{h.regionName}</span>
                <span className="text-gray-400">
                  {ASSET_TYPES.find(t => t.value === h.assetType)?.label} · {DEAL_TYPES.find(t => t.value === h.dealType)?.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        {/* 주소 검색 — 메인 입력 */}
        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 border rounded-lg px-3 py-2.5 text-sm"
            placeholder="지역명 입력 후 Enter (예: 강남구, 마포구, 서울 강남)"
            value={regionQ}
            onChange={e => setRegionQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchRegion()}
          />
          <button
            onClick={() => searchRegion()}
            disabled={searching}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40 whitespace-nowrap"
          >
            {searching ? '검색 중…' : '검색'}
          </button>
        </div>

        {/* 지역 선택 (복수 결과) */}
        {regions.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {regions.map(r => (
              <button
                key={r.lawd_cd}
                onClick={() => selectRegion(r)}
                className="px-3 py-1 rounded-full text-sm border border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                {r.name}
              </button>
            ))}
          </div>
        )}

        {/* 선택된 지역 + 필터 */}
        {selectedRegion && (
          <div className="flex items-center gap-2 mb-4 p-2 bg-blue-50 rounded-lg">
            <span className="text-xs font-semibold text-blue-700">{selectedRegion.name}</span>
            <button onClick={() => { setSelectedRegion(null); setRegions([]); setResult(null); setRegionQ('') }}
              className="text-xs text-blue-400 hover:text-red-500">✕</button>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">유형</label>
            <select className="border rounded-lg px-3 py-2 text-sm" value={assetType}
              onChange={e => { setAssetType(e.target.value); if (selectedRegion) fetchTx(selectedRegion, e.target.value, dealType, months) }}>
              {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">거래</label>
            <select className="border rounded-lg px-3 py-2 text-sm" value={dealType}
              onChange={e => { setDealType(e.target.value); if (selectedRegion) fetchTx(selectedRegion, assetType, e.target.value, months) }}>
              {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">조회 월</label>
            <div className="flex gap-2 flex-wrap">
              <input
                ref={monthInputRef}
                type="month"
                className="border rounded-lg px-3 py-2 text-sm"
                defaultValue={currentYmInput()}
                max={currentYmInput()}
              />
              <button
                onClick={() => {
                  const v = monthInputRef.current?.value
                  if (v) addMonth(v.replace('-', ''))
                }}
                className="px-3 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700"
              >추가</button>
              <button onClick={() => addMonth(currentYm())} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">이번 달</button>
              <button onClick={() => setMonths(recentMonths(3))} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">최근 3개월</button>
              <button onClick={() => setMonths(recentMonths(6))} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">최근 6개월</button>
            </div>
          </div>
        </div>

        {months.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {months.map(m => (
              <div key={m} className="flex items-center gap-1 bg-blue-50 border border-blue-100 rounded-full px-3 py-1 text-sm text-blue-700">
                <span>{ymToDisplay(m)}</span>
                <button onClick={() => setMonths(months.filter(x => x !== m))} className="text-blue-300 hover:text-red-500 ml-1">×</button>
              </div>
            ))}
          </div>
        )}

        {isCommercialRent && (
          <p className="text-xs text-orange-600 mb-3">⚠ 상업업무용 전월세는 지원되지 않습니다.</p>
        )}

        <button
          disabled={!selectedRegion || months.length === 0 || loading || isCommercialRent}
          onClick={() => selectedRegion && fetchTx(selectedRegion, assetType, dealType, months)}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40"
        >
          {loading ? '조회 중…' : '조회'}
        </button>
        {!selectedRegion && <span className="ml-3 text-xs text-gray-400">지역을 입력하세요</span>}
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {!result && !loading && !error && (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-sm font-medium">지역명을 입력하고 Enter를 누르세요</p>
          <p className="text-xs mt-1">예: 강남구, 마포구, 서울 강남</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          실거래가 조회 중…
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold mb-3 text-sm text-gray-600">
              {selectedRegion?.name} · {ASSET_TYPES.find(t => t.value === assetType)?.label} · {DEAL_TYPES.find(t => t.value === dealType)?.label}
            </h2>
            <div className="flex flex-wrap gap-4 text-sm">
              <div><span className="text-gray-500">거래건수 </span><strong>{result.summary.sample_count}건</strong></div>
              {result.summary.median_price_10k && (
                <div><span className="text-gray-500">중위 매매가 </span><strong className="text-blue-600">{fmt(result.summary.median_price_10k)}</strong></div>
              )}
              {result.summary.min_price_10k && (
                <div><span className="text-gray-500">최저 </span><strong>{fmt(result.summary.min_price_10k)}</strong></div>
              )}
              {result.summary.max_price_10k && (
                <div><span className="text-gray-500">최고 </span><strong>{fmt(result.summary.max_price_10k)}</strong></div>
              )}
              {result.summary.median_deposit_10k && (
                <div><span className="text-gray-500">중위 보증금 </span><strong>{fmt(result.summary.median_deposit_10k)}</strong></div>
              )}
              {result.summary.monthly_rent_avg_10k && (
                <div><span className="text-gray-500">평균 월세 </span><strong>{fmt(result.summary.monthly_rent_avg_10k)}</strong></div>
              )}
            </div>
          </div>

          {result.items.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold mb-4">가격 분포 (상위 20건)</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={result.items.slice(0, 20).map(i => ({ name: i.name, 가격: i.price_10k ?? i.deposit_10k }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Bar dataKey="가격" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">단지명</th>
                  <th className="px-4 py-3 text-left">동</th>
                  <th className="px-4 py-3 text-right">면적(㎡)</th>
                  <th className="px-4 py-3 text-right">층</th>
                  <th className="px-4 py-3 text-right">가격</th>
                  <th className="px-4 py-3 text-left">거래일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-gray-500">{item.district}</td>
                    <td className="px-4 py-3 text-right">{item.area_m2}</td>
                    <td className="px-4 py-3 text-right">{item.floor}층</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-600">
                      {fmt(item.price_10k ?? item.deposit_10k)}
                      {item.monthly_rent_10k ? `/${fmt(item.monthly_rent_10k)}` : ''}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.deal_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
