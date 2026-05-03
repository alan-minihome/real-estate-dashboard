export interface CriteriaItem {
  key: string
  label: string
  unit: string
  direction: 'max' | 'min'
  default: number
  min: number
  max: number
  step: number
  enabled: boolean
  // 기준 설명
  desc: string        // 한 줄 요약
  detail: string      // 상세 이유 (저자 관점)
  goodSign: string    // 기준 통과 시 의미
  badSign: string     // 기준 미통과 시 의미
}

export const CRITERIA_CATALOG: CriteriaItem[] = [
  {
    key: "payout_ratio_max",
    label: "배당성향",
    unit: "%",
    direction: "max",
    default: 70,
    min: 20, max: 100, step: 5,
    enabled: true,
    desc: "순이익 중 배당으로 지급하는 비율 (낮을수록 안전)",
    detail: "벌어들인 이익의 70% 이내에서 배당을 지급해야 장기적으로 배당을 유지·증가시킬 수 있습니다. 100%를 넘으면 이익보다 더 많은 배당을 지급하는 것으로, 배당 삭감 위험이 높습니다.",
    goodSign: "배당 지속성과 성장 여력 충분",
    badSign: "배당 삭감 또는 정체 위험 — 재무 부담 점검 필요",
  },
  {
    key: "div_growth_5y_min",
    label: "5년 배당성장률",
    unit: "%",
    direction: "min",
    default: 5,
    min: 1, max: 20, step: 1,
    enabled: true,
    desc: "최근 5년간 연평균 배당 증가율 (CAGR)",
    detail: "배당성장률 5%면 14년 만에 배당이 2배가 됩니다. 인플레이션(평균 3%)을 웃도는 배당 성장이어야 실질 구매력이 유지됩니다. 배당성장주 투자의 핵심 기준입니다.",
    goodSign: "복리 효과로 장기 수익률 극대화 가능",
    badSign: "배당 정체 — 인플레이션 대비 실질 수익 하락 우려",
  },
  {
    key: "peg_max",
    label: "PEG 비율",
    unit: "",
    direction: "max",
    default: 1.5,
    min: 0.5, max: 3, step: 0.1,
    enabled: true,
    desc: "PER ÷ EPS 성장률 (1 이하 = 성장 대비 저평가)",
    detail: "PER만으로는 성장성을 반영하지 못합니다. PEG는 PER을 성장률로 나눠 밸류에이션을 조정한 값입니다. 1.5 이하면 성장 대비 합리적인 가격, 2를 넘으면 고평가 구간으로 봅니다.",
    goodSign: "성장 대비 합리적인 매수 가격",
    badSign: "성장성 대비 주가 고평가 — 안전마진 부족",
  },
  {
    key: "de_ratio_max",
    label: "부채비율 D/E",
    unit: "",
    direction: "max",
    default: 2,
    min: 0.5, max: 5, step: 0.1,
    enabled: true,
    desc: "자기자본 대비 부채 비율 (낮을수록 재무 건전)",
    detail: "경기 침체나 금리 상승 시 고부채 기업은 배당을 줄이거나 유상증자로 주주 가치를 훼손할 수 있습니다. D/E 2 이하면 안전, 금융주·유틸리티는 업종 특성상 예외 적용 가능합니다.",
    goodSign: "불황에도 배당 유지 가능한 재무 구조",
    badSign: "금리 상승·경기 침체 시 배당 삭감 위험",
  },
  {
    key: "roe_min",
    label: "ROE",
    unit: "%",
    direction: "min",
    default: 15,
    min: 5, max: 50, step: 1,
    enabled: true,
    desc: "자기자본이익률 — 주주 돈을 얼마나 잘 굴리는가",
    detail: "ROE 15% 이상이면 자기자본 100원으로 매년 15원 이상을 벌어들이는 우량 기업입니다. 버핏이 선호하는 지표로, 높은 ROE가 지속되는 기업은 경쟁 우위(해자)를 가진 경우가 많습니다.",
    goodSign: "지속적 경쟁 우위 — 복리 성장 가능한 기업",
    badSign: "자본 활용 효율 낮음 — 성장 동력 확인 필요",
  },
  {
    key: "eps_growth_min",
    label: "EPS 성장률",
    unit: "%",
    direction: "min",
    default: 5,
    min: 1, max: 20, step: 1,
    enabled: true,
    desc: "주당순이익 성장률 — 미래 배당 성장의 원천",
    detail: "배당은 이익에서 나옵니다. EPS 성장이 없으면 배당 성장도 한계가 있습니다. 장기적으로 EPS 성장률과 배당 성장률은 수렴하므로, EPS 5% 이상 성장하는 기업이 배당성장주의 요건을 갖춥니다.",
    goodSign: "배당 성장 지속을 뒷받침하는 이익 성장",
    badSign: "이익 정체 → 배당 성장 한계, 장기 보유 매력 약화",
  },
  {
    key: "yield_vs_avg_min",
    label: "배당률 vs 5년 평균",
    unit: "%p",
    direction: "min",
    default: 0,
    min: -1, max: 2, step: 0.1,
    enabled: true,
    desc: "현재 배당률이 5년 평균보다 높으면 상대적 저평가 신호",
    detail: "같은 기업의 배당률이 역사적 평균보다 높다는 건 주가가 상대적으로 낮다는 의미입니다. 이는 매수 타이밍을 포착하는 핵심 신호로, 0%p 이상이면 평균 수준, +0.5%p 이상이면 매력적인 매수 구간입니다.",
    goodSign: "⚡ 매수 신호 — 역사적 저평가 구간",
    badSign: "현재 배당률이 역사 평균 이하 — 주가 고평가 가능성",
  },
  {
    key: "fcf_yield_min",
    label: "FCF 수익률",
    unit: "%",
    direction: "min",
    default: 2,
    min: 0.5, max: 10, step: 0.5,
    enabled: true,
    desc: "잉여현금흐름 ÷ 시가총액 — 배당의 실질 재원",
    detail: "회계 이익이 아닌 실제 현금을 기준으로 한 수익률입니다. FCF 수익률이 배당률보다 높아야 배당이 안전하게 지급됩니다. 회계 이익을 조작하기는 쉽지만 현금은 조작하기 어렵습니다.",
    goodSign: "현금 기반의 실질적인 배당 지급 능력 확인",
    badSign: "이익 대비 현금 창출 부족 — 배당 지속성 의문",
  },
  {
    key: "div_yield_min",
    label: "현재 배당률 최소",
    unit: "%",
    direction: "min",
    default: 0.5,
    min: 0.1, max: 5, step: 0.1,
    enabled: false,
    desc: "최소 배당률 기준 — 배당 자체가 없는 종목 제외",
    detail: "배당성장주 투자에서 배당률이 너무 낮으면(0.5% 미만) 배당 자체의 의미가 희석됩니다. 단, GOOGL·AAPL처럼 최근 배당을 시작한 기업은 낮은 배당률로 시작하더라도 빠른 성장이 가능합니다.",
    goodSign: "의미 있는 배당 수익 + 성장 잠재력 보유",
    badSign: "배당 수익 미미 — 순수 배당 목적 보유 부적합",
  },
]
