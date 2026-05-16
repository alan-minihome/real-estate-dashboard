'use client'
import { useState } from 'react'
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

function fmt(val: number | undefined) {
  if (!val) return '-'
  if (val >= 10000) return `${(val / 10000).toFixed(1)}억`
  return `${val.toLocaleString()}만`
}

export default function TransactionsPage() {
  const [regionQ, setRegionQ] = useState('')
  const [regions, setRegions] = useState<RegionResult[]>([])
  const [selectedRegion, setSelectedRegion] = useState<RegionResult | null>(null)
  const [assetType, setAssetType] = useState('apartment')
  const [dealType, setDealType] = useState('trade')
  const [months, setMonths] = useState<string[]>([])
  const [result, setResult] = useState<TxResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const currentYm = () => {
    const d = new Date()
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  const searchRegion = async () => {
    if (!regionQ.trim()) return
    const res = await fetch(`/api/transactions?q=${encodeURIComponent(regionQ)}`)
    const data = await res.json()
    setRegions(data.results ?? [])
  }

  const fetchTx = async (dealYmd: string) => {
    if (!selectedRegion) return
    setLoading(true); setError('')
    try {
      const res = await fetch(
        `/api/transactions?lawdCd=${selectedRegion.lawd_cd}&dealYmd=${dealYmd}&assetType=${assetType}&dealType=${dealType}`
      )
      const data = await res.json()
      if (data.error) setError(data.error)
      else setResult(data)
    } catch {
      setError('조회 실패')
    } finally {
      setLoading(false)
    }
  }

  const addMonth = () => {
    const ym = currentYm()
    if (!months.includes(ym)) setMonths([...months, ym])
  }

  const isCommercialRent = assetType === 'commercial' && dealType === 'rent'

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">실거래가 조회</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
            placeholder="지역명 (예: 강남구, 마포구, 서울 강남)"
            value={regionQ}
            onChange={e => setRegionQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchRegion()}
          />
          <button onClick={searchRegion} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">지역 검색</button>
        </div>

        {regions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {regions.map(r => (
              <button
                key={r.lawd_cd}
                onClick={() => setSelectedRegion(r)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${selectedRegion?.lawd_cd === r.lawd_cd ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:border-blue-400'}`}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">유형</label>
            <select className="border rounded-lg px-3 py-2 text-sm" value={assetType} onChange={e => setAssetType(e.target.value)}>
              {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">거래</label>
            <select className="border rounded-lg px-3 py-2 text-sm" value={dealType} onChange={e => setDealType(e.target.value)}>
              {DEAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">조회 월 (YYYYMM)</label>
            <div className="flex gap-2">
              <input
                className="border rounded-lg px-3 py-2 text-sm w-32"
                placeholder={currentYm()}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value
                    if (v && !months.includes(v)) setMonths([...months, v])
                  }
                }}
              />
              <button onClick={addMonth} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">이번 달</button>
            </div>
          </div>
        </div>

        {months.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {months.map(m => (
              <div key={m} className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm">
                <span>{m}</span>
                <button onClick={() => setMonths(months.filter(x => x !== m))} className="text-gray-400 hover:text-red-500">×</button>
              </div>
            ))}
          </div>
        )}

        {isCommercialRent && (
          <p className="text-xs text-orange-600 mb-3">⚠ 상업업무용 전월세는 지원되지 않습니다.</p>
        )}

        <button
          disabled={!selectedRegion || months.length === 0 || loading || isCommercialRent}
          onClick={() => months.forEach(m => fetchTx(m))}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40"
        >
          {loading ? '조회 중…' : '조회'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {result && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold mb-3">요약</h2>
            <div className="flex flex-wrap gap-4 text-sm">
              <div><span className="text-gray-500">거래건수 </span><strong>{result.summary.sample_count}건</strong></div>
              {result.summary.median_price_10k && (
                <div><span className="text-gray-500">중위 매매가 </span><strong>{fmt(result.summary.median_price_10k)}</strong></div>
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
