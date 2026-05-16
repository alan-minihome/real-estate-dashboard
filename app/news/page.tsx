'use client'
import { useState } from 'react'

const PRESETS = ['부동산', '아파트', '금리', '청약', '재개발', '전세 사기', '공시지가', '토지 거래 허가']

type NewsItem = {
  title: string; description: string; link: string; original_link?: string; pub_date: string; pub_date_iso?: string
}

export default function NewsPage() {
  const [query, setQuery] = useState('부동산')
  const [sort, setSort] = useState('date')
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async (q?: string) => {
    const qFinal = q ?? query
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/news?q=${encodeURIComponent(qFinal)}&sort=${sort}&display=30`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setNews(data.items ?? data.data ?? [])
    } catch {
      setError('뉴스 조회 실패')
    } finally {
      setLoading(false)
    }
  }

  const fmtDate = (iso?: string, raw?: string) => {
    if (iso) return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    return raw ?? ''
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">부동산 뉴스</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex gap-2 mb-3">
          <input
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="검색어 입력…"
          />
          <select className="border rounded-lg px-3 py-2 text-sm" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="date">최신순</option>
            <option value="sim">관련도순</option>
          </select>
          <button onClick={() => search()} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40">
            {loading ? '…' : '검색'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => { setQuery(p); search(p) }}
              className="text-xs px-3 py-1 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-full transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {news.length > 0 && (
        <div className="space-y-3">
          {news.map((item, i) => (
            <a
              key={i}
              href={item.original_link ?? item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm mb-1 line-clamp-2">{item.title}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{fmtDate(item.pub_date_iso, item.pub_date)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
