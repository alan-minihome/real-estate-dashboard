// 감시 종목 (사용자가 후보함에서 승격한 장기 모니터링 대상)
// 초기화: 비어있음. 후보함 → "감시로 승격"으로 채우거나 직접 추가
// macro_sensitivity: 'defensive' | 'moderate' | 'sensitive'
export const WATCHLIST: {
  ticker: string; name: string; type: string; sector: string;
  div_months: string; macro_sensitivity: string
}[] = []

export const SUPER_INVESTORS: Record<string, string[]> = {
  "워런 버핏 (Berkshire)": ["AAPL","AXP","BAC","KO","CVX","OXY","MCO","KHC","CB","DVA","V","GOOGL"],
  "도널드 약트먼 (Yacktman)": ["PEP","PG","GOOGL","KO","MSFT","PM","CSCO","UHR","BK"],
  "척 아크레 (Akre)": ["MA","V","AMT","MCO","KKR","ROP","CSGP","GPN","DHR","FICO","CPRT"],
  "제레미 그랜덤 (GMO)": ["MSFT","AAPL","AMZN","META","GOOGL","UNH","AVGO","TSM","JPM","V"],
}

export const SUPER_INVESTOR_COMMON = ["MSFT","AAPL","GOOGL","KO","V","MA","MCO","UNH","AVGO"]

export const MACRO_THRESHOLDS = {
  unemployment_spike: 0.5,
  yield_curve_warn: 0.0,
}
