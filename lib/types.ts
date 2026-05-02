export interface Stock {
  ticker: string
  fetched_at: string
  price: number | null
  currency: string
  market_cap: number | null
  div_yield: number | null
  div_yield_5y: number | null
  div_amount: number | null
  payout_ratio: number | null
  div_growth_5y: number | null
  peg: number | null
  de_ratio: number | null
  roe: number | null
  eps_growth: number | null
  fcf_yield: number | null
  sector: string | null
}

export interface Screening {
  id: number
  ticker: string
  screened_at: string
  pass_payout: number
  pass_div_growth: number
  pass_peg: number
  pass_de: number
  pass_roe: number
  pass_eps: number
  overall_pass: number
  buy_signal: number
  signal_reason: string | null
  criteria_json: string
}

export interface Portfolio {
  id: number
  synced_at: string
  ticker: string
  name: string | null
  quantity: number | null
  avg_price: number | null
  current_price: number | null
  currency: string
  eval_amount: number | null
  profit_loss: number | null
  profit_loss_pct: number | null
}

export interface DividendRecord {
  ticker: string
  ex_div_date: string
  pay_date: string | null
  amount: number | null
  currency: string
}

export interface MacroRecord {
  indicator: string
  recorded_at: string
  value: number
}

export interface CriteriaItem {
  key: string
  label: string
  unit: string
  direction: 'max' | 'min'
  default: number
  min: number
  max: number
  step: number
  source: string
  rationale: string
  enabled: boolean
}
