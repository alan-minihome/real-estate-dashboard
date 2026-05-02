'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import KumyungTaxBanner from '../components/KumyungTaxBanner'

const DIV_TAX_RATE = 15.4 // 배당소득세 원천징수율 (일반계좌 기준)

interface Candidate {
  id: number
  ticker: string
  name: string
  added_at: string
  target_shares: number
  memo: string
  status: string
  price: number | null
  div_yield: number | null
  div_yield_5y: number | null
  overall_pass: number | null
  buy_signal: number | null
  signal_reason: string | null
}

export default function CandidatesPage() {
  const router = useRouter()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [usdkrw, setUsdkrw] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editShares, setEditShares] = useState<number>(10)
  const [editMemo, setEditMemo] = useState<string>('')

  async function load() {
    setLoading(true)
    const [cr, mr] = await Promise.all([
      fetch('/api/candidates').then(r => r.json()),
      fetch('/api/market').then(r => r.json()).catch(() => ({})),
    ])
    if (Array.isArray(cr)) setCandidates(cr)
    if (mr?.USDKRW?.price) setUsdkrw(mr.USDKRW.price)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function remove(id: number) {
    await fetch(`/api/candidates/${id}`, { method: 'DELETE' })
    load()
  }

  async function markPurchased(id: number) {
    await fetch(`/api/candidates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'purchased' }),
    })
    load()
  }

  function startEdit(c: Candidate) {
    setEditingId(c.id)
    setEditShares(c.target_shares)
    setEditMemo(c.memo || '')
  }

  async function saveEdit(id: number) {
    await fetch(`/api/candidates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_shares: editShares, memo: editMemo }),
    })
    setEditingId(null)
    load()
  }

  // 시뮬레이션 페이지로 후보 데이터 전달 (URL 파라미터)
  function goSimulation() {
    const params = candidates
      .filter(c => c.status === 'watching')
      .map(c => `${c.ticker}:${c.target_shares}`)
      .join(',')
    router.push(`/simulation?candidates=${encodeURIComponent(params)}`)
  }

  const watching = candidates.filter(c => c.status === 'watching')
  const purchased = candidates.filter(c => c.status === 'purchased')

  const totalAnnualDiv = watching.reduce((sum, c) => {
    if (!c.price || !c.div_yield) return sum
    return sum + (c.price * c.target_shares * c.div_yield / 100)
  }, 0)

  if (loading) return (
    <div className="p-8 text-[#64748B]">불러오는 중...</div>
  )

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">📋 예비 후보함</h1>
          <p className="text-sm text-[#64748B] mt-1">
            매수 전 관심 종목을 담아두고 시뮬레이션해보세요
          </p>
        </div>
        <div className="flex gap-3">
          {watching.length > 0 && (
            <button
              onClick={goSimulation}
              className="px-4 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              🧮 시뮬레이션 실행
            </button>
          )}
        </div>
      </div>

      {/* KPI */}
      {watching.length > 0 && (() => {
        const netDiv = totalAnnualDiv * (1 - DIV_TAX_RATE / 100)
        const taxAmt = totalAnnualDiv - netDiv
        return (
          <>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                <p className="text-xs text-[#64748B]">관심 종목</p>
                <p className="text-2xl font-bold text-[#0F172A] mt-1">{watching.length}종목</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                <p className="text-xs text-[#64748B]">연간 배당 (세전)</p>
                <p className="text-xl font-bold text-[#0F172A] mt-1">${totalAnnualDiv.toFixed(0)}</p>
                {usdkrw && <p className="text-xs text-[#64748B]">₩{Math.round(totalAnnualDiv * usdkrw).toLocaleString()}</p>}
              </div>
              <div className="bg-blue-50 rounded-xl border border-[#1A56DB] p-4">
                <p className="text-xs text-[#64748B]">연간 배당 <span className="font-semibold text-[#1A56DB]">세후</span> ({DIV_TAX_RATE}% 차감)</p>
                <p className="text-xl font-bold text-[#1A56DB] mt-1">${netDiv.toFixed(0)}</p>
                {usdkrw && <p className="text-xs text-[#64748B]">₩{Math.round(netDiv * usdkrw).toLocaleString()}</p>}
                <p className="text-[10px] text-red-500 mt-0.5">세금 -${taxAmt.toFixed(0)}</p>
              </div>
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
                <p className="text-xs text-[#64748B]">매수신호 발생</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  {watching.filter(c => c.buy_signal).length}종목 ⚡
                </p>
              </div>
            </div>
            {/* 금융소득종합과세 경고 */}
            <div className="mb-6">
              <KumyungTaxBanner annualGrossUsd={totalAnnualDiv} usdkrw={usdkrw} />
            </div>
          </>
        )
      })()}

      {/* 관심 종목 테이블 */}
      {watching.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-16 text-center">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-[#64748B] font-medium">후보 종목이 없습니다</p>
          <p className="text-sm text-[#94A3B8] mt-2">
            스크리너 또는 신규 발굴 화면에서 종목을 추가하세요
          </p>
          <button
            onClick={() => router.push('/screener')}
            className="mt-4 px-4 py-2 text-sm text-[#1A56DB] border border-[#1A56DB] rounded-lg hover:bg-blue-50"
          >
            스크리너로 이동 →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-slate-50">
            <h2 className="text-sm font-semibold text-[#0F172A]">관심 종목 ({watching.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-slate-50/50">
                <th className="text-left px-4 py-2.5 font-medium text-[#64748B]">티커</th>
                <th className="text-left px-4 py-2.5 font-medium text-[#64748B]">종목명</th>
                <th className="text-right px-4 py-2.5 font-medium text-[#64748B]">현재가</th>
                <th className="text-center px-4 py-2.5 font-medium text-[#64748B]">배당률</th>
                <th className="text-center px-4 py-2.5 font-medium text-[#64748B]">신호</th>
                <th className="text-center px-4 py-2.5 font-medium text-[#64748B]">목표주수</th>
                <th className="text-right px-4 py-2.5 font-medium text-[#64748B]">예상 연배당</th>
                <th className="text-left px-4 py-2.5 font-medium text-[#64748B]">메모</th>
                <th className="text-center px-4 py-2.5 font-medium text-[#64748B]">액션</th>
              </tr>
            </thead>
            <tbody>
              {watching.map(c => {
                const annualDiv = c.price && c.div_yield
                  ? c.price * c.target_shares * c.div_yield / 100
                  : null
                const isEditing = editingId === c.id
                return (
                  <tr key={c.id} className={`border-b border-[#E2E8F0] last:border-0 ${c.buy_signal ? 'bg-emerald-50/40' : ''}`}>
                    <td className="px-4 py-3 font-bold text-[#1A56DB]">{c.ticker}</td>
                    <td className="px-4 py-3 text-[#0F172A]">{c.name}</td>
                    <td className="px-4 py-3 text-right tabular">
                      {c.price ? (
                        <div>
                          <span className="font-medium">${c.price.toFixed(2)}</span>
                          {usdkrw && <p className="text-[10px] text-[#94A3B8]">₩{Math.round(c.price * usdkrw).toLocaleString()}</p>}
                        </div>
                      ) : <span className="text-slate-300">–</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.div_yield ? (
                        <span className={c.div_yield_5y && c.div_yield > c.div_yield_5y ? 'text-emerald-600 font-medium' : ''}>
                          {c.div_yield.toFixed(2)}%
                        </span>
                      ) : '–'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.buy_signal
                        ? <span title={c.signal_reason || ''}>⚡</span>
                        : <span className="text-slate-300">–</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          min={1}
                          value={editShares}
                          onChange={e => setEditShares(Number(e.target.value))}
                          className="w-16 text-center border border-[#1A56DB] rounded px-1 py-0.5 text-sm"
                        />
                      ) : (
                        <span className="font-medium">{c.target_shares}주</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular text-sm">
                      {annualDiv ? (
                        <div>
                          <span className="font-medium">${annualDiv.toFixed(0)}</span>
                          {usdkrw && <p className="text-[10px] text-[#94A3B8]">₩{Math.round(annualDiv * usdkrw).toLocaleString()}</p>}
                        </div>
                      ) : '–'}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          value={editMemo}
                          onChange={e => setEditMemo(e.target.value)}
                          placeholder="메모 입력"
                          className="w-full border border-[#E2E8F0] rounded px-2 py-0.5 text-sm"
                        />
                      ) : (
                        <span className="text-[#64748B] text-xs">{c.memo || '–'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-center">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(c.id)}
                              className="text-xs px-2 py-1 bg-[#1A56DB] text-white rounded hover:bg-blue-700"
                            >저장</button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-xs px-2 py-1 border border-[#E2E8F0] rounded hover:bg-slate-50"
                            >취소</button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(c)}
                              className="text-xs px-2 py-1 border border-[#E2E8F0] rounded hover:bg-slate-50 text-[#64748B]"
                            >✏️</button>
                            <a
                              href={`https://naverconn.namusecurities.co.kr/link?code=${c.ticker}&exchange=NASDAQ`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            >매수</a>
                            <button
                              onClick={() => markPurchased(c.id)}
                              className="text-xs px-2 py-1 border border-emerald-300 text-emerald-600 rounded hover:bg-emerald-50"
                            >✓완료</button>
                            <button
                              onClick={() => remove(c.id)}
                              className="text-xs px-2 py-1 border border-red-200 text-red-400 rounded hover:bg-red-50"
                            >✕</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 매수 완료 종목 */}
      {purchased.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E2E8F0] bg-slate-50">
            <h2 className="text-sm font-semibold text-[#64748B]">매수 완료 ({purchased.length})</h2>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {purchased.map(c => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between text-sm text-[#64748B]">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-[#0F172A]">{c.ticker}</span>
                  <span>{c.name}</span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">매수완료</span>
                </div>
                <button
                  onClick={() => remove(c.id)}
                  className="text-xs text-[#94A3B8] hover:text-red-400"
                >제거</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
