'use client'
import { useState, useEffect } from 'react'

const PRESETS = ['부동산', '아파트', '금리', '청약', '재개발', '전세 사기', '공시지가', '토지 거래 허가']

type NewsItem = {
  title: string; description: string; link: string; original_link?: string; pub_date: string; pub_date_iso?: string
}

export default function NewsPage() {
  const [query, setQuery] = useState('부동산')
  const [sort, setSort] = useState('date')
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  useEffect(() => { search('부동산') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const search = async (q?: string) => {
    const qFinal = q ?? query
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/news?q=${encodeURIComponent(qFinal)}&sort=${sort}&display=30`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setNews(data.items ?? data.data ?? [])
      setSearched(true)
    } catch {
      setError('뉴스 조회 실패')
      setSearched(true)
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-4 flex items-start gap-4">
          <div className="text-2xl">📡</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700 mb-1">뉴스를 불러오지 못했습니다</p>
            <p className="text-xs text-red-500 mb-3">네이버 뉴스 API에 일시적인 문제가 있을 수 있습니다.</p>
            <button
              onClick={() => search()}
              className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          뉴스 불러오는 중…
        </div>
      )}

      {!loading && news.length > 0 && (
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
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-sm line-clamp-2 flex-1">{item.title}</h3>
                    <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{fmtDate(item.pub_date_iso, item.pub_date)}</span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed border-l-2 border-gray-100 pl-2">{item.description}</p>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {!loading && searched && news.length === 0 && !error && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm font-medium">검색 결과가 없습니다</p>
          <p className="text-xs mt-1">다른 키워드로 검색해 보세요.</p>
        </div>
      )}
    </div>
  )
}
