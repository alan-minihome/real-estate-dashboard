'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useCallback } from 'react'

const MENUS = [
  { href: '/',          label: '홈',           icon: '💰' },
  { href: '/portfolio', label: '포트폴리오',    icon: '📊' },
  null, // 구분선 — 발굴 & 분석
  { href: '/discover',      label: '주식 발굴',     icon: '🔭' },
  { href: '/screener',      label: '주식 스크리너',  icon: '🔍' },
  { href: '/etf-discover',  label: 'ETF 발굴',      icon: '🏦' },
  { href: '/etf-screener',  label: 'ETF 스크리너',  icon: '🎯' },
  { href: '/kr-etf',        label: '국내 ETF',      icon: '🇰🇷' },
  null, // 구분선 — 의사결정
  { href: '/candidates',    label: '예비 후보함',   icon: '📋' },
  { href: '/simulation',    label: '배당 시뮬레이션', icon: '🧮' },
  { href: '/accumulation',  label: '적립 시뮬레이션', icon: '📈' },
  null, // 구분선 — 모니터링
  { href: '/signals',       label: '매수 신호',     icon: '⚡' },
  { href: '/calendar',      label: '배당 캘린더',   icon: '📅' },
  { href: '/macro',         label: '거시경제',      icon: '🌍' },
  null, // 구분선
  { href: '/book',          label: '책 핵심 정리',  icon: '📖' },
]

type StepState = 'idle' | 'running' | 'done' | 'error'

interface Step {
  key: string
  label: string
  sublabel: string
  endpoint: string
}

const STEPS: Step[] = [
  { key: 'watch',    label: '감시종목',   sublabel: '배당률·신호 (~3분)',  endpoint: '/api/refresh' },
  { key: 'fred',     label: 'FRED 지표', sublabel: '거시경제 (~2분)',      endpoint: '/api/refresh/fred' },
  { key: 'universe', label: 'S&P 500',  sublabel: '전체 스크리닝 (~10분)', endpoint: '/api/refresh/universe' },
]

function stepIcon(state: StepState, spin: boolean) {
  if (state === 'running') return spin ? '⟳' : '⟳'
  if (state === 'done')    return '✓'
  if (state === 'error')   return '✕'
  return '○'
}

function stepColor(state: StepState) {
  if (state === 'running') return 'text-blue-400'
  if (state === 'done')    return 'text-emerald-400'
  if (state === 'error')   return 'text-red-400'
  return 'text-slate-500'
}

export default function Sidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [states, setStates] = useState<Record<string, StepState>>({
    watch: 'idle', fred: 'idle', universe: 'idle',
  })
  const [running, setRunning] = useState(false)
  const [doneAt, setDoneAt] = useState<string | null>(null)
  const [tick, setTick] = useState(0)  // for spin animation

  const runAll = useCallback(async () => {
    if (running) return
    setRunning(true)
    setDoneAt(null)
    setStates({ watch: 'idle', fred: 'idle', universe: 'idle' })
    setExpanded(true)

    for (const step of STEPS) {
      setStates(prev => ({ ...prev, [step.key]: 'running' }))
      // spin tick
      const spinInterval = setInterval(() => setTick(t => t + 1), 400)
      try {
        const res = await fetch(step.endpoint, { method: 'POST' })
        clearInterval(spinInterval)
        if (res.ok) {
          setStates(prev => ({ ...prev, [step.key]: 'done' }))
        } else {
          setStates(prev => ({ ...prev, [step.key]: 'error' }))
        }
      } catch {
        clearInterval(spinInterval)
        setStates(prev => ({ ...prev, [step.key]: 'error' }))
      }
    }

    setRunning(false)
    setDoneAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
  }, [running])

  const allDone = Object.values(states).every(s => s === 'done' || s === 'error')
  const anyError = Object.values(states).some(s => s === 'error')

  return (
    <aside className="w-60 min-h-screen bg-[var(--dd-sidebar)] flex flex-col fixed left-0 top-0 z-10">
      {/* 로고 */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--dd-blue)] flex items-center justify-center text-white text-sm font-bold">💰</div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">배당주 대시보드</p>
            <p className="text-[10px] text-slate-400 leading-tight">미국 배당성장주 모니터링</p>
          </div>
        </div>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {MENUS.map((item, i) => {
          if (!item) return <div key={`sep-${i}`} className="my-1 border-t border-white/10" />
          const { href, label, icon } = item
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-[var(--dd-blue)] text-white'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* 전체 갱신 패널 */}
      <div className="px-3 pb-4 border-t border-white/10 pt-3 space-y-2">
        {/* 토글 헤더 */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <span>🔄</span>
            <span>전체 갱신</span>
          </span>
          <span className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {/* 확장 패널 */}
        {expanded && (
          <div className="px-2 pb-1 space-y-1">
            {/* 스텝 목록 */}
            {STEPS.map(step => {
              const state = states[step.key]
              return (
                <div key={step.key} className="flex items-start gap-2 py-1">
                  <span className={`mt-0.5 text-xs font-bold w-3 text-center transition-all ${stepColor(state)} ${state === 'running' ? 'animate-spin' : ''}`}>
                    {stepIcon(state, tick % 2 === 0)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-tight ${state === 'idle' ? 'text-slate-500' : state === 'done' ? 'text-emerald-400' : state === 'error' ? 'text-red-400' : 'text-white'}`}>
                      {step.label}
                    </p>
                    <p className="text-[10px] text-slate-600 leading-tight">{step.sublabel}</p>
                  </div>
                </div>
              )
            })}

            {/* 완료 메시지 */}
            {!running && allDone && doneAt && (
              <p className={`text-[10px] mt-1 ${anyError ? 'text-red-400' : 'text-emerald-400'}`}>
                {anyError ? '일부 실패 — ' : '완료 — '}{doneAt}
              </p>
            )}

            {/* 실행 버튼 */}
            <button
              onClick={runAll}
              disabled={running}
              className={`w-full mt-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                running
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-[var(--dd-blue)] text-white hover:bg-blue-600 active:scale-95'
              }`}
            >
              {running ? '갱신 중…' : '▶ 지금 전체 갱신'}
            </button>

            <p className="text-[10px] text-slate-600 text-center">총 소요 약 15분</p>
          </div>
        )}

        {/* 접힌 상태에서도 진행 중이면 표시 */}
        {!expanded && running && (
          <p className="text-[10px] text-blue-400 text-center animate-pulse px-2">갱신 진행 중…</p>
        )}
        {!expanded && !running && doneAt && (
          <p className="text-[10px] text-slate-600 text-center px-2">
            {anyError ? '⚠ ' : '✓ '}{doneAt} 갱신
          </p>
        )}
      </div>
    </aside>
  )
}
