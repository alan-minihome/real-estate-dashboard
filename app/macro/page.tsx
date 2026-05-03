'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { MACRO_THRESHOLDS, WATCHLIST } from '@/lib/watchlist'

interface MacroRow { indicator: string; recorded_at: string; value: number }
interface MacroSignal { id: string; label: string; status: 'ok' | 'warning' | 'danger'; value: string; detail: string }
interface MacroSummary { risk_score: number; risk_level: 'low' | 'moderate' | 'high'; signals: MacroSignal[]; recommendation: string; updated_at: string|null }
interface MarketItem { price: number; change: number; pct: number }
interface MarketData { SPX?: MarketItem|null; NDX?: MarketItem|null; DJI?: MarketItem|null; VIX?: MarketItem|null; USDKRW?: MarketItem|null; TNX?: MarketItem|null }
interface HistoryPoint { date: string; close: number }
type MarketHistory = Record<string, HistoryPoint[]>

const MARKET_META: { key: keyof MarketData; label: string; unit: string; desc: string }[] = [
  { key: 'SPX',    label: 'S&P 500',    unit: '',  desc: '미국 대형주 500개' },
  { key: 'NDX',    label: 'NASDAQ 100', unit: '',  desc: '기술주 100개' },
  { key: 'DJI',    label: '다우존스',    unit: '',  desc: '우량주 30개' },
  { key: 'USDKRW', label: '달러/원',     unit: '₩', desc: '원화 환율' },
  { key: 'VIX',    label: 'VIX 공포지수', unit: '', desc: '30↑ 극도 공포' },
  { key: 'TNX',    label: '미 10년 국채', unit: '%', desc: '장기금리 기준' },
]

function MarketCard({ meta, data, history }: {
  meta: typeof MARKET_META[0]
  data: MarketItem|null|undefined
  history: HistoryPoint[]
}) {
  if (!data) return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
      <p className="text-xs text-[#64748B]">{meta.label}</p>
      <p className="text-sm text-slate-400 mt-2">데이터 없음</p>
    </div>
  )
  const up = data.pct >= 0
  const isVixHigh = meta.key === 'VIX' && data.price >= 30

  // 일별 → 월별 dedup (월의 마지막 거래일 기준)
  const monthlyMap: Record<string, HistoryPoint> = {}
  for (const h of history) {
    const month = h.date.slice(0, 7)
    monthlyMap[month] = h
  }
  const monthlyHistory = Object.values(monthlyMap).slice(-6)

  // 6개월 추세 계산 (첫번째 vs 마지막)
  const trendUp = monthlyHistory.length >= 2
    ? monthlyHistory[monthlyHistory.length - 1].close >= monthlyHistory[0].close
    : up

  const chartColor = meta.key === 'VIX'
    ? (isVixHigh ? '#E02424' : '#1A56DB')
    : (trendUp ? '#059669' : '#E02424')

  return (
    <div className={`bg-white rounded-xl border p-4 ${isVixHigh ? 'border-red-300 bg-red-50' : 'border-[#E2E8F0]'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[#64748B]">{meta.label}</p>
          <p className="text-[10px] text-slate-400">{meta.desc}</p>
        </div>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${up ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {up ? '▲' : '▼'} {Math.abs(data.pct).toFixed(2)}%
        </span>
      </div>
      <p className="text-xl font-bold text-[#0F172A] mt-2 tabular">
        {meta.unit}{data.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
      </p>
      <p className={`text-xs mt-0.5 tabular ${up ? 'text-emerald-600' : 'text-red-600'}`}>
        {up ? '+' : ''}{data.change.toLocaleString('en-US', { maximumFractionDigits: 2 })}
      </p>

      {/* 6개월 미니 차트 */}
      {monthlyHistory.length > 1 && (
        <div className="mt-3 -mx-1">
          <ResponsiveContainer width="100%" height={64}>
            <LineChart data={monthlyHistory} margin={{ top: 4, right: 2, bottom: 16, left: 2 }}>
              <YAxis domain={['auto', 'auto']} hide />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 8, fill: '#94A3B8' }}
                tickFormatter={(v: string) => `${parseInt(v.slice(5, 7))}월`}
                interval={0}
                axisLine={false}
                tickLine={false}
              />
              <Line type="monotone" dataKey="close" stroke={chartColor} dot={{ r: 2.5, fill: chartColor, strokeWidth: 0 }} strokeWidth={1.5} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload as HistoryPoint
                  return (
                    <div className="bg-white border border-[#E2E8F0] rounded px-2 py-1 text-[10px] shadow-sm">
                      <p className="text-slate-400">{d.date}</p>
                      <p className="font-bold">{meta.unit}{d.close.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                    </div>
                  )
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

const FRED_INDICATORS = [
  { id: 'T10Y2Y', label: '장단기 금리차 (10Y-2Y)', unit: '%',  warn: MACRO_THRESHOLDS.yield_curve_warn,
    desc: '0% 이하 역전 → 평균 12~18개월 후 경기침체 신호',
    invest: '역전 시 방어주(KO·PG·JNJ) 비중 확대, 경기소비재(SBUX·NKE) 비중 축소 고려' },
  { id: 'UNRATE', label: '미국 실업률',            unit: '%',  warn: null,
    desc: '3개월 전 대비 +0.5%p 이상 급등 시 경기 위축 경고',
    invest: '실업률 급등 시 배당 삭감 위험 기업(고부채·경기민감) 비중 점검' },
  { id: 'RSAFS',  label: '소매판매',               unit: 'B$', warn: null,
    desc: '2개월 연속 감소 시 소비 위축 — 경기침체 동행 지표',
    invest: '소매판매 감소 지속 시 필수소비재(KO·COST·PG) 비중 방어적으로 유지' },
]

const STATUS_DOT: Record<string, string> = {
  ok: 'bg-emerald-500', warning: 'bg-amber-400', danger: 'bg-red-500',
}
const STATUS_TEXT: Record<string, string> = {
  ok: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  warning: 'text-amber-700 bg-amber-50 border-amber-200',
  danger: 'text-red-700 bg-red-50 border-red-200',
}
const RISK_COLOR: Record<string, string> = {
  low: 'text-emerald-600', moderate: 'text-amber-600', high: 'text-red-600',
}
const RISK_LABEL: Record<string, string> = {
  low: '저위험', moderate: '주의', high: '경고',
}

const INVESTOR_ADVICE: Record<string, { title: string; color: string; actions: string[] }> = {
  low: {
    title: '거시환경 양호 — 정상 기준 종목 선별',
    color: 'bg-emerald-50 border-emerald-200',
    actions: [
      '배당성장률·ROE·PEG 기준으로 최선호 종목 선별',
      '배당률이 5년 평균 대비 높은 종목 매수 타이밍 포착',
      '섹터 불문 스크리닝 기준 충족 종목 중심 투자',
    ],
  },
  moderate: {
    title: '일부 신호 감지 — 포트폴리오 방어력 점검',
    color: 'bg-amber-50 border-amber-200',
    actions: [
      '경기소비재(SBUX·NKE)·고부채 종목 비중 점검',
      '필수소비재(KO·PG·COST)·헬스케어(JNJ·UNH) 비중 유지',
      '신규 매수 시 배당성향·부채비율 기준 강화 적용',
    ],
  },
  high: {
    title: '복수 경고 신호 — 방어적 포트폴리오 구성',
    color: 'bg-red-50 border-red-200',
    actions: [
      '거시 민감 종목(AMAT·AVGO·NKE) 비중 축소 검토',
      '방어주 (KO·PG·JNJ·SCHD·UNH) 비중 확대',
      '배당 안정성 우선 — 배당성향 60% 이하 종목 집중',
    ],
  },
}

function MacroChart({ ind }: { ind: typeof FRED_INDICATORS[0] }) {
  const [data, setData] = useState<MacroRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/macro/${ind.id}`).then(r => r.json()).then(d => {
      const rows = Array.isArray(d) ? [...d].reverse() : []
      const oneYearAgo = new Date()
      oneYearAgo.setMonth(oneYearAgo.getMonth() - 12)
      const filtered = rows.filter(r => new Date(r.recorded_at) >= oneYearAgo)
      // 월별 dedup — 같은 달 중 마지막 레코드만 유지
      const monthMap: Record<string, MacroRow> = {}
      for (const r of filtered) monthMap[r.recorded_at.slice(0, 7)] = r
      setData(Object.values(monthMap).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)))
    }).finally(() => setLoading(false))
  }, [ind.id])

  const latest = data[data.length - 1]?.value
  const prev = data[data.length - 2]?.value
  const delta = latest !== undefined && prev !== undefined ? (latest - prev) : null
  const firstVal = data[0]?.value
  const totalChange = latest !== undefined && firstVal !== undefined ? latest - firstVal : null

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-semibold text-[#0F172A]">{ind.label}</p>
        {latest !== undefined && (
          <div className="text-right">
            <span className="text-lg font-bold tabular text-[#0F172A]">{latest.toFixed(2)}{ind.unit}</span>
            {delta !== null && (
              <span className={`ml-2 text-xs font-medium ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
              </span>
            )}
          </div>
        )}
      </div>
      {totalChange !== null && (
        <p className="text-[10px] text-slate-400 mb-1">
          12개월 변화: <span className={totalChange >= 0 ? 'text-emerald-600' : 'text-red-600'}>
            {totalChange >= 0 ? '+' : ''}{totalChange.toFixed(2)}{ind.unit}
          </span>
        </p>
      )}
      <p className="text-xs text-[#64748B] mb-1">{ind.desc}</p>
      <p className="text-xs text-[#1A56DB] mb-3">💡 {ind.invest}</p>
      {loading ? (
        <div className="h-36 flex items-center justify-center text-[#64748B] text-sm">로딩 중...</div>
      ) : data.length === 0 ? (
        <div className="h-36 flex items-center justify-center text-[#64748B] text-sm">데이터 없음 — FRED 갱신 후 확인</div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data.map(r => ({ date: r.recorded_at.slice(0, 7), value: r.value }))} margin={{ top: 20, right: 12, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#64748B' }}
              tickFormatter={(v: string) => `${parseInt(v.slice(5, 7))}월`}
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} width={36} />
            <Tooltip
              formatter={(v) => typeof v === 'number' ? [`${v.toFixed(2)}${ind.unit}`, ind.label] : v}
              labelFormatter={(l) => {
                const s = String(l)
                return `${s.slice(0,4)}년 ${parseInt(s.slice(5,7))}월`
              }}
            />
            {ind.warn !== null && <ReferenceLine y={ind.warn} stroke="#E02424" strokeDasharray="4 2" label={{ value: '0%', position: 'insideTopLeft', fontSize: 9, fill: '#E02424' }} />}
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--dd-blue, #533afd)"
              dot={{ r: 4, fill: 'var(--dd-blue, #533afd)', strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              strokeWidth={2}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              label={(props: any) => {
                const x = Number(props.x ?? 0)
                const y = Number(props.y ?? 0)
                const { value } = props
                if (value === undefined) return <text />
                const num = typeof value === 'number' ? value : parseFloat(String(value))
                return (
                  <text x={x} y={y - 10} fill="#50617a" fontSize={9} textAnchor="middle" fontWeight={500}>
                    {isNaN(num) ? String(value) : num.toFixed(2)}
                  </text>
                )
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default function MacroPage() {
  const [summary, setSummary] = useState<MacroSummary|null>(null)
  const [market, setMarket] = useState<MarketData|null>(null)
  const [marketHistory, setMarketHistory] = useState<MarketHistory>({})
  const [marketLoading, setMarketLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/macro/summary').then(r => r.json()).then(d => setSummary(d))
    Promise.all([
      fetch('/api/market').then(r => r.json()),
      fetch('/api/market/history').then(r => r.json()).catch(() => ({})),
    ]).then(([cur, hist]) => {
      setMarket(cur)
      setMarketHistory(hist || {})
    }).finally(() => setMarketLoading(false))
  }, [])

  async function refreshFred() {
    setRefreshing(true)
    const r = await fetch('/api/refresh/fred', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) })
    const d = await r.json()
    setMsg(d.ok ? '갱신 완료!' : `실패: ${d.error}`)
    if (d.ok) fetch('/api/macro/summary').then(r => r.json()).then(d => setSummary(d))
    setRefreshing(false)
  }

  const advice = summary ? INVESTOR_ADVICE[summary.risk_level] : null
  // WATCHLIST가 비어있으면 표시 자체가 무의미하므로 빈 상태도 처리
  const sensitiveTickers = WATCHLIST.filter(w => w.macro_sensitivity === 'sensitive').map(w => w.ticker)
  const defensiveTickers = WATCHLIST.filter(w => w.macro_sensitivity === 'defensive').map(w => w.ticker)
  const hasMacroSensitivity = sensitiveTickers.length > 0 || defensiveTickers.length > 0

  return (
    <div className="max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">거시경제 신호등</h1>
          <p className="text-sm text-[#64748B] mt-0.5">미국 시장 현황 · FRED 경기 지표 · 배당주 투자 해석</p>
        </div>
        <button onClick={refreshFred} disabled={refreshing}
          className="px-4 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {refreshing ? '수집 중...' : '🔄 FRED 갱신'}
        </button>
      </div>
      {msg && <div className={`mb-4 p-3 rounded-xl text-sm border ${msg.includes('완료') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{msg}</div>}

      {/* ── SECTION 1: 시장 현황 ── */}
      <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wide mb-3">시장 현황 (6개월 추이)</h2>
      {marketLoading ? (
        <div className="h-24 flex items-center justify-center text-slate-400 text-sm mb-4">시장 데이터 로딩 중...</div>
      ) : (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {MARKET_META.map(m => (
            <MarketCard key={m.key} meta={m} data={market?.[m.key]} history={marketHistory[m.key] || []} />
          ))}
        </div>
      )}

      {/* S&P500 히트맵 */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden mb-6">
        <div className="px-4 py-2 border-b border-[#E2E8F0]">
          <p className="text-sm font-semibold text-[#0F172A]">S&P 500 섹터별 히트맵</p>
        </div>
        <iframe
          src="https://s.tradingview.com/embed-widget/stock-heatmap/?locale=kr#%7B%22dataSource%22%3A%22SPX500%22%2C%22blockSize%22%3A%22market_cap_basic%22%2C%22blockColor%22%3A%22change%22%2C%22grouping%22%3A%22sector%22%2C%22colorTheme%22%3A%22light%22%2C%22hasTopBar%22%3Atrue%2C%22isDataSetEnabled%22%3Atrue%2C%22isZoomEnabled%22%3Atrue%2C%22hasSymbolTooltip%22%3Atrue%2C%22isMonoSize%22%3Afalse%7D"
          style={{ width: '100%', height: 420, border: 'none', display: 'block' }}
          scrolling="no"
        />
      </div>

      {/* ── SECTION 2: 거시 신호등 ── */}
      <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wide mb-3">경기 신호등 (FRED)</h2>

      {summary && (
        <>
          {/* 종합 위험도 */}
          <div className={`rounded-xl border p-5 mb-4 ${STATUS_TEXT[summary.risk_level === 'low' ? 'ok' : summary.risk_level === 'moderate' ? 'warning' : 'danger']}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {summary.risk_level === 'low' ? '🟢' : summary.risk_level === 'moderate' ? '🟡' : '🔴'}
                </span>
                <div>
                  <p className="font-bold text-base">종합 위험도: <span className={RISK_COLOR[summary.risk_level]}>{RISK_LABEL[summary.risk_level]}</span></p>
                  <p className="text-xs mt-0.5">{summary.updated_at ? `기준일 ${summary.updated_at.slice(0,10)}` : ''}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs">경고 신호</p>
                <p className="text-2xl font-bold">{summary.risk_score} / 3</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {summary.signals.map(s => (
                <div key={s.id} className="bg-white/60 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s.status]}`} />
                    <p className="text-xs font-medium">{s.label}</p>
                  </div>
                  <p className="text-base font-bold">{s.value}</p>
                  <p className="text-xs mt-0.5 opacity-80">{s.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 배당주 투자자 액션 */}
          {advice && (
            <div className={`rounded-xl border p-5 mb-6 ${advice.color}`}>
              <p className="text-sm font-bold mb-3">💡 배당주 투자자 관점 — {advice.title}</p>
              <ul className="space-y-1.5">
                {advice.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-[#1A56DB] font-bold shrink-0">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
              {summary.risk_level !== 'low' && hasMacroSensitivity && (
                <div className="mt-4 pt-3 border-t border-current/20 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-semibold mb-1">⚠️ 비중 점검 대상 (경기민감)</p>
                    <div className="flex flex-wrap gap-1">
                      {sensitiveTickers.map(t => <span key={t} className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full">{t}</span>)}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">🛡️ 방어 유지 대상 (방어주)</p>
                    <div className="flex flex-wrap gap-1">
                      {defensiveTickers.map(t => <span key={t} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">{t}</span>)}
                    </div>
                  </div>
                </div>
              )}
              {summary.risk_level !== 'low' && !hasMacroSensitivity && (
                <p className="mt-3 pt-2 border-t border-current/20 text-[11px] opacity-80">
                  ※ 감시 종목에 macro_sensitivity 분류가 등록되지 않아 종목별 점검 표시 생략
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── SECTION 3: FRED 개별 차트 (6개월) ── */}
      <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wide mb-3">FRED 상세 차트 (최근 12개월)</h2>
      <div className="grid grid-cols-1 gap-4">
        {FRED_INDICATORS.map(ind => <MacroChart key={ind.id} ind={ind} />)}
      </div>
    </div>
  )
}
