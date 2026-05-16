'use client'
import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type LandResult = {
  address: string; jibun: string
  latest: { price_per_sqm: number; year: number }
  history: Array<{ year: number; price_per_sqm: number }>
  yoy_change_pct: number
}

export default function LandPricePage() {
  const [address, setAddress] = useState('')
  const [result, setResult] = useState<LandResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async () => {
    if (!address.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/land-price?address=${encodeURIComponent(address)}`)
      const data = await res.json()
      if (data.error) setError(data.error)
      else setResult(data)
    } catch {
      setError('조회 실패')
    } finally {
      setLoading(false)
    }
  }

  const fmt = (v: number) => `${v.toLocaleString()}원/㎡`

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">공시지가 조회</h1>
      <p className="text-xs text-gray-500 mb-6">재산세·종합부동산세·양도소득세 기준 개별공시지가 (매년 1월 1일 기준, 4~5월 공시)</p>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
            placeholder="예: 서울 강남구 삼성동 1  /  서울 마포구 합정동 1-1"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <button onClick={search} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40">
            {loading ? '조회 중…' : '조회'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">형식: 시도 시군구 읍면동 [산] 본번[-부번]</p>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {result && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold mb-3">{result.address}</h2>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-gray-500 text-xs mb-1">공시기준연도</p>
                <p className="font-bold text-lg">{result.latest.year}년</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">공시지가</p>
                <p className="font-bold text-lg">{fmt(result.latest.price_per_sqm)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">전년 대비</p>
                <p className={`font-bold text-lg ${result.yoy_change_pct >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  {result.yoy_change_pct >= 0 ? '+' : ''}{result.yoy_change_pct.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>

          {result.history.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold mb-4">연도별 추이</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={result.history}>
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}천`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Line type="monotone" dataKey="price_per_sqm" stroke="#3b82f6" dot strokeWidth={2} name="공시지가" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
