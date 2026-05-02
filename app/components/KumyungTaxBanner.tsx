/**
 * 금융소득종합과세 임계값 경고 배너
 *
 * 연간 금융소득(배당+이자) 합산이 2,000만 원 초과 시
 * 종합소득세 과세 대상이 됩니다. (소득세법 §62)
 *
 * 구간별 경고:
 *  – 50% (~1,000만원): 가볍게 안내
 *  – 80% (~1,600만원): 주의
 *  – 95% (~1,900만원): 강한 경고
 *  – 100% (2,000만원+): 초과
 */

const THRESHOLD_KRW = 20_000_000 // 2,000만 원

interface Props {
  /** 연간 배당 세전 합계 (USD) */
  annualGrossUsd: number
  /** USD/KRW 환율 */
  usdkrw: number | null
  /** 추가 이자소득 (KRW, 선택). 기본 0. */
  interestKrw?: number
  /** 컴팩트 모드: 진행바 없이 한 줄 뱃지 */
  compact?: boolean
}

function getRatio(totalKrw: number) {
  return Math.min(totalKrw / THRESHOLD_KRW, 1.2) // 120% 까지 표시
}

export default function KumyungTaxBanner({
  annualGrossUsd,
  usdkrw,
  interestKrw = 0,
  compact = false,
}: Props) {
  if (!usdkrw || annualGrossUsd <= 0) return null

  const divKrw = annualGrossUsd * usdkrw
  const totalKrw = divKrw + interestKrw
  const ratio = totalKrw / THRESHOLD_KRW
  const pct = Math.min(ratio * 100, 120)
  const remaining = Math.max(THRESHOLD_KRW - totalKrw, 0)

  // 단계 결정
  const stage =
    ratio >= 1.0 ? 'over' :
    ratio >= 0.95 ? 'danger' :
    ratio >= 0.80 ? 'warning' :
    ratio >= 0.50 ? 'notice' :
    'safe'

  if (stage === 'safe') return null // 50% 미만은 표시 안 함

  const config = {
    over:    { bg: 'bg-red-50',    border: 'border-red-300',    bar: 'bg-red-500',    text: 'text-red-700',    icon: '🚨', label: '종합과세 초과' },
    danger:  { bg: 'bg-red-50',    border: 'border-red-200',    bar: 'bg-red-400',    text: 'text-red-700',    icon: '🔴', label: '종합과세 임박' },
    warning: { bg: 'bg-amber-50',  border: 'border-amber-200',  bar: 'bg-amber-400',  text: 'text-amber-700',  icon: '🟡', label: '종합과세 주의' },
    notice:  { bg: 'bg-blue-50',   border: 'border-blue-200',   bar: 'bg-blue-400',   text: 'text-blue-700',   icon: 'ℹ️', label: '종합과세 확인' },
    safe:    { bg: '', border: '', bar: '', text: '', icon: '', label: '' },
  }[stage]

  const fmtKRW = (n: number) =>
    n >= 10_000_000
      ? `${(n / 10_000_000).toFixed(1)}천만원`
      : `${Math.round(n / 10_000).toLocaleString()}만원`

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${config.bg} ${config.border} ${config.text}`}>
        {config.icon} {config.label} {fmtKRW(totalKrw)} / 2,000만원 ({Math.round(ratio * 100)}%)
      </span>
    )
  }

  return (
    <div className={`rounded-xl border p-4 ${config.bg} ${config.border}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className={`text-sm font-bold ${config.text}`}>
            {config.icon} 금융소득종합과세 임계값
          </p>
          <p className={`text-xs mt-0.5 ${config.text} opacity-80`}>
            연간 금융소득 2,000만 원 초과 시 모든 금융소득이 종합소득세 과세 대상 (소득세법 §62)
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-lg font-bold tabular ${config.text}`}>{fmtKRW(totalKrw)}</p>
          <p className={`text-xs ${config.text} opacity-70`}>/ 2,000만원 기준</p>
        </div>
      </div>

      {/* 진행바 */}
      <div className="h-2 bg-white/60 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all ${config.bar}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className={`${config.text} opacity-70`}>
          배당 {fmtKRW(divKrw)}
          {interestKrw > 0 && ` + 이자 ${fmtKRW(interestKrw)}`}
        </span>
        {stage === 'over' ? (
          <span className={`font-bold ${config.text}`}>
            {fmtKRW(totalKrw - THRESHOLD_KRW)} 초과 — 종합소득세 신고 필요
          </span>
        ) : (
          <span className={`${config.text} opacity-80`}>
            {fmtKRW(remaining)} 남음 ({Math.round(ratio * 100)}%)
          </span>
        )}
      </div>

      {stage === 'over' && (
        <p className={`mt-2 text-xs ${config.text} opacity-80 border-t border-red-200 pt-2`}>
          ※ 세후 금액은 개인 종합소득 구간(6.6%~49.5%)에 따라 달라질 수 있습니다. 세무사 상담을 권장합니다.
        </p>
      )}
    </div>
  )
}
