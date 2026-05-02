'use client'
import { useEffect, useState, useMemo } from 'react'
import { WATCHLIST } from '@/lib/watchlist'
import { DIV_MONTHS_MAP } from '@/lib/author-picks'

interface Dividend { ticker: string; ex_div_date: string; pay_date: string|null; amount: number|null; currency: string }
interface CandidateRow { ticker: string; name: string; status: string }
interface CustomItem { ticker: string; name: string }

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

// ticker → div_months 통합 lookup (WATCHLIST 우선, 없으면 DIV_MONTHS_MAP)
function getDivMonths(ticker: string): string | null {
  const wl = WATCHLIST.find(w => w.ticker === ticker)
  if (wl?.div_months) return wl.div_months
  return DIV_MONTHS_MAP[ticker] || null
}

export default function CalendarPage() {
  const [upcoming, setUpcoming] = useState<Dividend[]>([])
  const [history, setHistory] = useState<Dividend[]>([])
  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [customWatchlist, setCustomWatchlist] = useState<CustomItem[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/dividends').then(r => r.json()),
      fetch('/api/candidates').then(r => r.json()).catch(() => []),
      fetch('/api/stocks').then(r => r.json()).catch(() => ({ customWatchlist: [] })),
    ]).then(([upcomingData, candidatesData, stocksData]) => {
      setUpcoming(Array.isArray(upcomingData) ? upcomingData : [])
      const cands = Array.isArray(candidatesData)
        ? candidatesData.filter((c: CandidateRow) => c.status === 'watching')
        : []
      setCandidates(cands)
      setCustomWatchlist(stocksData.customWatchlist || [])
      // 기본 선택: 후보함 첫 종목 → WATCHLIST 첫 종목 → 'O'
      if (cands.length > 0) setSelected(cands[0].ticker)
      else if (WATCHLIST.length > 0) setSelected(WATCHLIST[0].ticker)
      else setSelected('O')
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selected) return
    fetch(`/api/dividends/${selected}`).then(r => r.json()).then(d => setHistory(Array.isArray(d) ? d : []))
  }, [selected])

  // 통합 종목 목록 (후보함 + WATCHLIST + customWatchlist)
  const allItems = useMemo(() => {
    const seen = new Set<string>()
    const items: { ticker: string; name: string }[] = []
    for (const c of candidates) {
      if (seen.has(c.ticker)) continue
      seen.add(c.ticker)
      items.push({ ticker: c.ticker, name: c.name })
    }
    for (const w of WATCHLIST) {
      if (seen.has(w.ticker)) continue
      seen.add(w.ticker)
      items.push({ ticker: w.ticker, name: w.name })
    }
    for (const c of customWatchlist) {
      if (seen.has(c.ticker)) continue
      seen.add(c.ticker)
      items.push({ ticker: c.ticker, name: c.name || c.ticker })
    }
    return items
  }, [candidates, customWatchlist])

  // 그룹별 종목 (배당월 매핑 적용)
  const groups = useMemo(() => {
    const result: Record<string, { ticker: string; name: string }[]> = {
      '매월': [], '1/4/7/10': [], '2/5/8/11': [], '3/6/9/12': [], '미상': []
    }
    for (const item of allItems) {
      const dm = getDivMonths(item.ticker)
      if (dm && result[dm]) result[dm].push(item)
      else result['미상'].push(item)
    }
    return result
  }, [allItems])

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">로딩 중...</div>

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">📅 배당 캘린더</h1>
      <p className="text-sm text-[#64748B] mb-6">관심 종목 {allItems.length}개 — 후보함 {candidates.length} + 감시 {WATCHLIST.length + customWatchlist.length}</p>

      {allItems.length === 0 && (
        <div className="mb-6 p-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <p className="font-semibold mb-1">📋 관심 종목이 없습니다</p>
          <p>예비 후보함이나 감시 목록에 종목을 추가하면 배당 일정이 표시됩니다.</p>
        </div>
      )}

      {/* 월별 배당 그룹 */}
      {allItems.length > 0 && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            { label: '매월',         key: '매월' },
            { label: '1·4·7·10월',  key: '1/4/7/10' },
            { label: '2·5·8·11월',  key: '2/5/8/11' },
            { label: '3·6·9·12월',  key: '3/6/9/12' },
            { label: '배당월 미상', key: '미상' },
          ].map(g => (
            <div key={g.key} className="bg-white rounded-xl border border-[#E2E8F0] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-[#64748B] uppercase">{g.label}</p>
                <span className="text-[10px] text-[#94A3B8]">{groups[g.key].length}개</span>
              </div>
              <div className="flex flex-wrap gap-1 min-h-[24px]">
                {groups[g.key].length === 0
                  ? <span className="text-[10px] text-slate-300">–</span>
                  : groups[g.key].map(t =>
                      <span
                        key={t.ticker}
                        title={t.name}
                        className={`text-xs px-2 py-0.5 rounded font-medium ${g.key === '미상' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-[#1A56DB]'}`}
                      >{t.ticker}</span>
                    )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 연간 타임라인 */}
      {allItems.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 mb-6">
          <p className="text-sm font-semibold mb-4">연간 배당 타임라인</p>
          <div className="grid grid-cols-12 gap-1">
            {MONTHS.map((m, idx) => {
              const monthNum = idx + 1
              const tickers: string[] = []
              for (const item of allItems) {
                const dm = getDivMonths(item.ticker)
                if (!dm) continue
                if (dm === '매월') tickers.push(item.ticker)
                else if (dm.split('/').map(Number).includes(monthNum)) tickers.push(item.ticker)
              }
              return (
                <div key={m} className="text-center">
                  <p className="text-[10px] text-[#64748B] mb-1 font-medium">{m}</p>
                  <div className="flex flex-col gap-0.5">
                    {tickers.map(t => <span key={t} className="text-[9px] px-1 py-0.5 bg-blue-50 text-[#1A56DB] rounded font-bold">{t}</span>)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 향후 배당 일정 */}
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-3">향후 배당 일정</h2>
        {upcoming.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center text-[#64748B] text-sm">
            향후 배당 일정 데이터가 없습니다. 데이터 갱신 후 확인해 주세요.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2E8F0]">
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">티커</th>
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">배당락일</th>
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">지급일</th>
                  <th className="text-right px-4 py-3 font-medium text-[#64748B]">배당금($)</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((d, i) => (
                  <tr key={`${d.ticker}-${d.ex_div_date}`} className={`border-b border-[#E2E8F0] last:border-0 ${i % 2 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-4 py-3 font-bold text-[#1A56DB]">{d.ticker}</td>
                    <td className="px-4 py-3 tabular">{d.ex_div_date}</td>
                    <td className="px-4 py-3 tabular text-[#64748B]">{d.pay_date || '–'}</td>
                    <td className="px-4 py-3 text-right tabular">{d.amount ? d.amount.toFixed(4) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 종목별 배당 이력 */}
      <div>
        <div className="flex items-center gap-4 mb-3">
          <h2 className="text-base font-semibold">종목별 배당 이력</h2>
          {allItems.length > 0 ? (
            <select value={selected} onChange={e => setSelected(e.target.value)}
              className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-[#1A56DB]">
              {allItems.map(item => <option key={item.ticker} value={item.ticker}>{item.ticker} ({item.name})</option>)}
            </select>
          ) : (
            <span className="text-xs text-[#94A3B8]">관심 종목 추가 후 사용 가능</span>
          )}
        </div>
        {history.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 text-center text-[#64748B] text-sm">해당 종목의 배당 이력이 없습니다.</div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2E8F0]">
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">배당락일</th>
                  <th className="text-left px-4 py-3 font-medium text-[#64748B]">지급일</th>
                  <th className="text-right px-4 py-3 font-medium text-[#64748B]">배당금</th>
                </tr>
              </thead>
              <tbody>
                {history.map((d, i) => (
                  <tr key={d.ex_div_date} className={`border-b border-[#E2E8F0] last:border-0 ${i % 2 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-4 py-3 tabular">{d.ex_div_date}</td>
                    <td className="px-4 py-3 tabular text-[#64748B]">{d.pay_date || '–'}</td>
                    <td className="px-4 py-3 text-right tabular">${d.amount?.toFixed(4) ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
