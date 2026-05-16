'use client'
import { useState } from 'react'

const COURTS: Record<string, string> = {
  '서울중앙': 'B000210', '서울동부': 'B000220', '서울서부': 'B000230',
  '서울남부': 'B000240', '서울북부': 'B000250', '인천': 'B000630',
  '수원': 'B000560', '성남': 'B000570', '부천': 'B000610',
  '의정부': 'B000270', '고양': 'B000290', '부산': 'B001010',
  '대구': 'B001410', '광주': 'B001610', '대전': 'B001210',
}

export default function AuctionPage() {
  const [court, setCourt] = useState('서울중앙')
  const [date, setDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [caseNumber, setCaseNumber] = useState('')
  const [result, setResult] = useState<{ search_url: string; notice: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const search = async () => {
    setLoading(true)
    const params = new URLSearchParams({ courtCode: COURTS[court] })
    if (caseNumber) params.set('caseNumber', caseNumber)
    else params.set('date', date)
    const res = await fetch(`/api/auction?${params}`)
    setResult(await res.json())
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-3">법원 경매</h1>
      <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
        <span className="text-orange-500 text-lg shrink-0">⚠</span>
        <div className="text-sm text-orange-800">
          <p className="font-semibold mb-0.5">자동 조회 시 IP 차단 위험</p>
          <p className="text-xs text-orange-700">courtauction.go.kr는 빠른 요청 시 약 1시간 IP 차단됩니다. 이 페이지는 <strong>검색 URL만 생성</strong>하며, 실제 조회는 브라우저에서 직접 수행하세요.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">법원</label>
            <select className="border rounded-lg px-3 py-2 text-sm" value={court} onChange={e => setCourt(e.target.value)}>
              {Object.keys(COURTS).map(c => <option key={c} value={c}>{c}지방법원</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">매각기일 (YYYY-MM)</label>
            <input
              className="border rounded-lg px-3 py-2 text-sm"
              value={date}
              onChange={e => setDate(e.target.value)}
              placeholder="2026-05"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 mb-1 block">사건번호 (직접 조회, 선택)</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={caseNumber}
              onChange={e => setCaseNumber(e.target.value)}
              placeholder="예: 2024타경100001"
            />
          </div>
        </div>
        <button onClick={search} disabled={loading} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40">
          {loading ? '생성 중…' : 'URL 생성'}
        </button>
      </div>

      {result && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="p-3 bg-orange-50 rounded-lg text-sm text-orange-700">{result.notice}</div>
          <div>
            <p className="text-xs text-gray-500 mb-2">아래 URL을 브라우저에서 여세요:</p>
            <a
              href={result.search_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 bg-blue-50 rounded-lg text-blue-700 text-sm break-all hover:underline"
            >
              {result.search_url}
            </a>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">법원 경매 공식 사이트 바로가기:</p>
            <a
              href="https://www.courtauction.go.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm"
            >
              법원경매 사이트 열기 ↗
            </a>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">지원 법원 코드</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(COURTS).map(([name, code]) => (
                <span key={code} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                  {name} <span className="text-gray-400">{code}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
