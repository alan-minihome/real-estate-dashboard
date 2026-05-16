'use client'
import { useState } from 'react'

const PRESETS = ['주택법', '공인중개사법', '민법 전세', '부동산등기법', '임대차보호법', '토지거래허가', '재건축초과이익환수']
const TYPES = [
  { value: 'law', label: '법령' },
  { value: 'precedent', label: '판례' },
  { value: 'ordinance', label: '자치법규' },
]

type LawItem = { title?: string; name?: string; content?: string; summary?: string; url?: string; case_number?: string }

export default function LawPage() {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('law')
  const [results, setResults] = useState<LawItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async (q?: string, t?: string) => {
    const qFinal = q ?? query
    const tFinal = t ?? type
    if (!qFinal.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/law?q=${encodeURIComponent(qFinal)}&type=${tFinal}`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResults(data.results ?? data.items ?? data.data ?? [])
    } catch {
      setError('조회 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">법령 검색</h1>
      <p className="text-xs text-gray-500 mb-6">부동산 관련 법령·판례·자치법규 탐색 (국가법령정보센터 기반)</p>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex gap-2 mb-3">
          <input
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="예: 주택법 제2조, 임대차 계약 갱신, 전세 사기"
          />
          <select className="border rounded-lg px-3 py-2 text-sm" value={type} onChange={e => setType(e.target.value)}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button onClick={() => search()} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40">
            {loading ? '…' : '검색'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => { setQuery(p); search(p, type) }}
              className="text-xs px-3 py-1 bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-full transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4 text-sm text-orange-700">
          <p className="font-semibold mb-1">조회 실패</p>
          <p>{error}</p>
          <p className="mt-2 text-xs">법령 검색은 <a href="https://www.law.go.kr" target="_blank" rel="noopener noreferrer" className="underline">국가법령정보센터</a>에서 직접 검색하실 수도 있습니다.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((item, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-medium text-sm mb-2">{item.title ?? item.name ?? item.case_number}</h3>
              {(item.content ?? item.summary) && (
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-4">{item.content ?? item.summary}</p>
              )}
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-2 inline-block">
                  원문 보기 ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">⚖️</div>
          <p className="text-sm">키워드를 입력하거나 빠른 검색을 선택하세요.</p>
          <p className="text-xs mt-1">
            <a href="https://www.law.go.kr" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              국가법령정보센터 ↗
            </a>도 참고하세요.
          </p>
        </div>
      )}
    </div>
  )
}
