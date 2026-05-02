// 🎯 결과 배지 — 기준통과(overall_pass) + 가격신호(buy_signal) 조합으로 4상태
// ✅+⚡ = 🎯 매수 후보 / ✅+– = ✅ 기다림 / ❌+⚡ = ⚠️ 함정 주의 / ❌+– = –

interface Props {
  overallPass: number | null | undefined
  buySignal: number | null | undefined
  signalReason?: string | null
  size?: 'sm' | 'md'
}

export default function VerdictBadge({ overallPass, buySignal, signalReason, size = 'md' }: Props) {
  // null = 평가되지 않음
  if (overallPass === null || overallPass === undefined) {
    return <span className="text-slate-300">–</span>
  }

  const pass = overallPass === 1
  const signal = buySignal === 1
  const text = size === 'sm' ? 'text-[10px]' : 'text-xs'
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-0.5'

  if (pass && signal) {
    return (
      <span
        title={signalReason ? `매수 후보: ${signalReason}` : '매수 후보 (기준통과 + 가격매력)'}
        className={`${padding} ${text} rounded-full font-medium bg-emerald-100 text-emerald-700 border border-emerald-300 whitespace-nowrap`}
      >
        🎯 매수 후보
      </span>
    )
  }
  if (pass && !signal) {
    return (
      <span
        title="좋은 회사이지만 현재 가격이 5년 평균 +1%p 미달 — 더 떨어지면 매수 기회"
        className={`${padding} ${text} rounded-full font-medium bg-blue-50 text-[#1A56DB] border border-blue-200 whitespace-nowrap`}
      >
        ✅ 기다림
      </span>
    )
  }
  if (!pass && signal) {
    return (
      <span
        title={`함정 주의: 가격은 매력적이지만 종목 품질 미달 (배당성향·ROE 등). ${signalReason || ''}`}
        className={`${padding} ${text} rounded-full font-medium bg-amber-50 text-amber-700 border border-amber-300 whitespace-nowrap`}
      >
        ⚠️ 함정 주의
      </span>
    )
  }
  return <span className="text-slate-300">–</span>
}
