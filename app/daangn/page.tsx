'use client'
import { useState } from 'react'

const SALES_TYPES = ['', 'APARTMENT', 'OFFICETEL', 'VILLA', 'SINGLE_HOUSE', 'COMMERCIAL']
const SALES_LABELS: Record<string, string> = {
  '': '전체', APARTMENT: '아파트', OFFICETEL: '오피스텔', VILLA: '빌라', SINGLE_HOUSE: '단독', COMMERCIAL: '상업',
}
const TRADE_TYPES = ['', 'SALE', 'LONG_TERM_RENT', 'MONTHLY_RENT']
const TRADE_LABELS: Record<string, string> = { '': '전체', SALE: '매매', LONG_TERM_RENT: '전세', MONTHLY_RENT: '월세' }

type Article = {
  title: string; salesType: string; trade: string
  area?: number; areaPyeong?: number; totalManageCost?: number; url: string
}

export default function DaangnPage() {
  const [region, setRegion] = useState('')
  const [salesType, setSalesType] = useState('')
  const [tradeType, setTradeType] = useState('')
  const [articles, setArticles] = useState<Article[]>([])
  const [effectiveRegion, setEffectiveRegion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async () => {
    if (!region.trim()) return
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ region, limit: '30' })
      if (salesType) params.set('salesType', salesType)
      if (tradeType) params.set('tradeType', tradeType)
      const res = await fetch(`/api/daangn?${params}`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setArticles(data.articles ?? [])
      setEffectiveRegion(data.effective_region ?? region)
    } catch {
      setError('조회 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">당근부동산</h1>
      <p className="text-xs text-gray-500 mb-6">당근부동산 공개 매물 검색 (읽기 전용 · 문의·예약·계약 불가)</p>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 mb-1 block">지역</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="예: 합정동, 마포구, 판교동"
              value={region}
              onChange={e => setRegion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">유형</label>
            <select className="border rounded-lg px-3 py-2 text-sm" value={salesType} onChange={e => setSalesType(e.target.value)}>
              {SALES_TYPES.map(t => <option key={t} value={t}>{SALES_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">거래</label>
            <select className="border rounded-lg px-3 py-2 text-sm" value={tradeType} onChange={e => setTradeType(e.target.value)}>
              {TRADE_TYPES.map(t => <option key={t} value={t}>{TRADE_LABELS[t]}</option>)}
            </select>
          </div>
        </div>
        <button onClick={search} disabled={loading} className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm disabled:opacity-40">
          {loading ? '검색 중…' : '검색'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {articles.length > 0 && (
        <>
          <p className="text-xs text-gray-500 mb-3">
            적용 지역: <strong>{effectiveRegion}</strong> · {articles.length}건
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {articles.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                    {SALES_LABELS[a.salesType] ?? a.salesType}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {TRADE_LABELS[a.trade] ?? a.trade}
                  </span>
                </div>
                <h3 className="font-medium text-sm mb-1 line-clamp-2">{a.title}</h3>
                <div className="text-xs text-gray-500 flex gap-2">
                  {a.areaPyeong && <span>{a.areaPyeong.toFixed(1)}평</span>}
                  {a.totalManageCost && <span>관리비 {a.totalManageCost.toLocaleString()}원</span>}
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
