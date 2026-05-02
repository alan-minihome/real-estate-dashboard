'use client'
import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import KpiCard from '../components/KpiCard'

interface PortfolioItem {
  ticker: string; name: string|null; quantity: number|null; avg_price: number|null
  current_price: number|null; eval_amount: number|null; profit_loss: number|null
  profit_loss_pct: number|null; synced_at: string
}

const SECTOR_COLORS = ['#1A56DB','#0E9F6E','#D97706','#E02424','#7C3AED','#DB2777','#0891B2','#059669']

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portfolio').then(r => r.json()).then(d => {
      setItems(Array.isArray(d) ? d : [])
    }).finally(() => setLoading(false))
  }, [])

  const totalEval = items.reduce((acc, i) => acc + (i.eval_amount || 0), 0)
  const totalPL = items.reduce((acc, i) => acc + (i.profit_loss || 0), 0)
  const lastSync = items[0]?.synced_at?.slice(0, 16).replace('T', ' ') ?? '없음'

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">로딩 중...</div>

  if (items.length === 0) return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">📊 포트폴리오</h1>
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center text-[#64748B]">
        <p className="text-lg mb-2">포트폴리오 데이터가 없습니다</p>
        <p className="text-sm">NH투자증권 API 연동 후 데이터가 표시됩니다</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📊 포트폴리오</h1>
        <span className="text-xs text-[#64748B]">마지막 동기화: {lastSync}</span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiCard label="총 평가금액" value={`$${totalEval.toLocaleString(undefined, {maximumFractionDigits: 0})}`} accent />
        <KpiCard label="총 손익" value={`${totalPL >= 0 ? '+' : ''}$${totalPL.toLocaleString(undefined, {maximumFractionDigits: 0})}`} signal={totalPL > 0} />
        <KpiCard label="보유 종목" value={`${items.length}종목`} />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E2E8F0]">
                <th className="text-left px-4 py-3 font-medium text-[#64748B]">티커</th>
                <th className="text-right px-4 py-3 font-medium text-[#64748B]">평가금액</th>
                <th className="text-right px-4 py-3 font-medium text-[#64748B]">손익률</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.ticker} className={`border-b border-[#E2E8F0] last:border-0 ${i % 2 ? 'bg-slate-50/50' : ''}`}>
                  <td className="px-4 py-3 font-bold text-[#1A56DB]">{item.ticker}</td>
                  <td className="px-4 py-3 text-right tabular">${(item.eval_amount || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                  <td className={`px-4 py-3 text-right tabular font-medium ${(item.profit_loss_pct || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {(item.profit_loss_pct || 0) >= 0 ? '+' : ''}{(item.profit_loss_pct || 0).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <p className="text-sm font-medium mb-4 text-[#0F172A]">종목 배분</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={items.map(i => ({ name: i.ticker, value: i.eval_amount || 0 }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
                {items.map((_, idx) => <Cell key={idx} fill={SECTOR_COLORS[idx % SECTOR_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => typeof v === 'number' ? `$${v.toLocaleString()}` : v} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
