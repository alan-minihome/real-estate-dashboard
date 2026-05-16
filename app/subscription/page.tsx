'use client'
import { useState } from 'react'

const STATUS_OPTIONS = ['', '공고중', '접수중', '접수마감', '당첨자발표', '추정공고']
const REGION_OPTIONS = ['', '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
const TYPE_MAP: Record<string, string> = { '': '전체', '05': '분양주택', '06': '임대주택', '13': '복지주택', '22': '상업시설' }

type Notice = {
  panId: string; panNm: string; cnpCdNm: string; panNtStDt: string
  clsgDt: string; panSs: string; uppAisTpCd: string; url?: string
}

export default function SubscriptionPage() {
  const [status, setStatus] = useState('')
  const [region, setRegion] = useState('')
  const [keyword, setKeyword] = useState('')
  const [typeCode, setTypeCode] = useState('')
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const search = async (p = 1) => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: '20' })
      if (status) params.set('status', status)
      if (region) params.set('region', region)
      if (keyword) params.set('keyword', keyword)
      if (typeCode) params.set('category', typeCode)
      const res = await fetch(`/api/subscription?${params}`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setNotices(data.items ?? data.data ?? [])
      setTotal(data.total ?? data.totalCount ?? 0)
      setPage(p)
    } catch {
      setError('조회 실패')
    } finally {
      setLoading(false)
    }
  }

  const statusColor = (s: string) => {
    if (s === '접수중') return 'bg-green-100 text-green-700'
    if (s === '공고중') return 'bg-blue-100 text-blue-700'
    if (s === '접수마감') return 'bg-gray-100 text-gray-600'
    return 'bg-yellow-100 text-yellow-700'
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">LH 청약 공고</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">상태</label>
            <select className="border rounded-lg px-3 py-2 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || '전체'}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">지역</label>
            <select className="border rounded-lg px-3 py-2 text-sm" value={region} onChange={e => setRegion(e.target.value)}>
              {REGION_OPTIONS.map(r => <option key={r} value={r}>{r || '전체'}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">유형</label>
            <select className="border rounded-lg px-3 py-2 text-sm" value={typeCode} onChange={e => setTypeCode(e.target.value)}>
              {Object.entries(TYPE_MAP).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 mb-1 block">키워드</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="공고명 검색…"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
            />
          </div>
        </div>
        <button onClick={() => search()} disabled={loading} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40">
          {loading ? '조회 중…' : '검색'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {notices.length > 0 && (
        <>
          <p className="text-xs text-gray-500 mb-3">총 {total.toLocaleString()}건 (현재 페이지 {notices.length}건)</p>
          <div className="space-y-3">
            {notices.map(n => (
              <div key={n.panId} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-sm mb-1">{n.panNm}</h3>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>{n.cnpCdNm}</span>
                      <span>공고 {n.panNtStDt}</span>
                      <span>마감 {n.clsgDt}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(n.panSs)}`}>{n.panSs}</span>
                    <span className="text-xs text-gray-400">{TYPE_MAP[n.uppAisTpCd] ?? n.uppAisTpCd}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            {page > 1 && <button onClick={() => search(page - 1)} className="px-4 py-2 border rounded-lg text-sm">이전</button>}
            <button onClick={() => search(page + 1)} className="px-4 py-2 border rounded-lg text-sm">다음</button>
          </div>
        </>
      )}
    </div>
  )
}
