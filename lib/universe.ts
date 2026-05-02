// 배당 킹: 50년 이상 연속 배당 증가 기업
export const DIVIDEND_KINGS: { ticker: string; name: string; years: number }[] = [
  { ticker: "ABM",  name: "ABM Industries",        years: 57 },
  { ticker: "ABT",  name: "애보트",                years: 52 },
  { ticker: "ABBV", name: "애브비",                years: 52 },
  { ticker: "AWR",  name: "American States Water", years: 69 },
  { ticker: "BKH",  name: "Black Hills Corp",      years: 54 },
  { ticker: "CBSH", name: "Commerce Bancshares",   years: 56 },
  { ticker: "CINF", name: "Cincinnati Financial",  years: 64 },
  { ticker: "CL",   name: "콜게이트-팜올리브",     years: 61 },
  { ticker: "CWT",  name: "California Water",      years: 55 },
  { ticker: "DOV",  name: "Dover Corp",            years: 68 },
  { ticker: "FRT",  name: "Federal Realty",        years: 56 },
  { ticker: "FUL",  name: "H.B. Fuller",           years: 54 },
  { ticker: "GPC",  name: "Genuine Parts",         years: 68 },
  { ticker: "GRC",  name: "Gorman-Rupp",           years: 51 },
  { ticker: "HRL",  name: "호멜 푸드",             years: 58 },
  { ticker: "ITW",  name: "일리노이 툴 웍스",      years: 50 },
  { ticker: "JNJ",  name: "존슨앤존슨",            years: 62 },
  { ticker: "KMB",  name: "킴벌리-클라크",         years: 52 },
  { ticker: "KO",   name: "코카콜라",              years: 62 },
  { ticker: "LANC", name: "Lancaster Colony",      years: 61 },
  { ticker: "LOW",  name: "로우스",                years: 51 },
  { ticker: "MSEX", name: "Middlesex Water",       years: 51 },
  { ticker: "NDSN", name: "Nordson",               years: 61 },
  { ticker: "NFG",  name: "National Fuel Gas",     years: 53 },
  { ticker: "NUE",  name: "뉴코어",                years: 51 },
  { ticker: "PEP",  name: "펩시코",                years: 52 },
  { ticker: "PG",   name: "P&G",                   years: 68 },
  { ticker: "PH",   name: "파커 해니핀",           years: 68 },
  { ticker: "PPG",  name: "PPG Industries",        years: 52 },
  { ticker: "SCL",  name: "Stepan Company",        years: 56 },
  { ticker: "SJW",  name: "SJW Group",             years: 57 },
  { ticker: "SYY",  name: "시스코",                years: 54 },
  { ticker: "TGT",  name: "타겟",                  years: 52 },
  { ticker: "UVV",  name: "Universal Corp",        years: 53 },
  { ticker: "WMT",  name: "월마트",                years: 50 },
]

// 배당 귀족: S&P 500 내 25년 이상 연속 배당 증가 기업 (킹 미포함)
export const DIVIDEND_ARISTOCRATS: { ticker: string; name: string; years: number }[] = [
  { ticker: "ADP",  name: "오토매틱 데이터",          years: 49 },
  { ticker: "AMCR", name: "암코",                     years: 40 },
  { ticker: "APD",  name: "에어 프로덕츠",            years: 42 },
  { ticker: "AOS",  name: "A.O. 스미스",              years: 30 },
  { ticker: "ATO",  name: "Atmos Energy",             years: 40 },
  { ticker: "BDX",  name: "벡턴 디킨슨",             years: 52 },
  { ticker: "BRO",  name: "Brown & Brown",            years: 30 },
  { ticker: "CAH",  name: "카디널 헬스",              years: 38 },
  { ticker: "CAT",  name: "캐터필러",                 years: 30 },
  { ticker: "CB",   name: "처브",                     years: 31 },
  { ticker: "CHD",  name: "Church & Dwight",          years: 28 },
  { ticker: "CTAS", name: "신타스",                   years: 41 },
  { ticker: "CVX",  name: "쉐브론",                   years: 37 },
  { ticker: "ED",   name: "Con Edison",               years: 49 },
  { ticker: "EMR",  name: "에머슨 일렉트릭",          years: 47 },
  { ticker: "ESS",  name: "Essex Property",           years: 29 },
  { ticker: "ETN",  name: "이튼",                     years: 13 },
  { ticker: "EW",   name: "에드워즈 라이프사이언스",  years: 12 },
  { ticker: "EXPD", name: "Expeditors International", years: 30 },
  { ticker: "FAST", name: "패스트날",                 years: 25 },
  { ticker: "FDS",  name: "팩트셋",                   years: 25 },
  { ticker: "GD",   name: "제너럴 다이나믹스",        years: 32 },
  { ticker: "GWW",  name: "W.W. 그레인저",            years: 52 },
  { ticker: "IBM",  name: "IBM",                      years: 28 },
  { ticker: "LIN",  name: "린데",                     years: 30 },
  { ticker: "MCD",  name: "맥도날드",                 years: 47 },
  { ticker: "MDT",  name: "메드트로닉",               years: 46 },
  { ticker: "MKC",  name: "맥코믹",                  years: 38 },
  { ticker: "MMM",  name: "3M",                       years: 64 },
  { ticker: "NEE",  name: "넥스트에라 에너지",        years: 29 },
  { ticker: "O",    name: "리얼티인컴",               years: 30 },
  { ticker: "PNR",  name: "펜타이어",                 years: 48 },
  { ticker: "ROP",  name: "로퍼 테크놀로지스",       years: 31 },
  { ticker: "ROST", name: "로스 스토어스",            years: 29 },
  { ticker: "SPGI", name: "S&P 글로벌",              years: 51 },
  { ticker: "SWK",  name: "스탠리 블랙앤데커",       years: 56 },
  { ticker: "TROW", name: "T. 로 프라이스",          years: 38 },
  { ticker: "WBA",  name: "월그린스",                 years: 47 },
  { ticker: "XOM",  name: "엑슨모빌",                years: 41 },
]

export type UniverseTier = 'king' | 'aristocrat' | 'both'

export interface UniverseStock {
  ticker: string
  name: string
  years: number
  tier: UniverseTier
}

export function buildUniverse(): UniverseStock[] {
  const kingTickers = new Set(DIVIDEND_KINGS.map(k => k.ticker))
  const aristocratTickers = new Set(DIVIDEND_ARISTOCRATS.map(a => a.ticker))
  const result: UniverseStock[] = []
  for (const k of DIVIDEND_KINGS) {
    result.push({ ...k, tier: aristocratTickers.has(k.ticker) ? 'both' : 'king' })
  }
  for (const a of DIVIDEND_ARISTOCRATS) {
    if (!kingTickers.has(a.ticker)) {
      result.push({ ...a, tier: 'aristocrat' })
    }
  }
  return result
}

export const UNIVERSE = buildUniverse()
export const UNIVERSE_TICKERS = UNIVERSE.map(u => u.ticker)

// API route에서 사용: 연속증가연수 맵 / 킹·귀족 분류 맵
export const KNOWN_YEARS: Record<string, number> = Object.fromEntries([
  ...DIVIDEND_KINGS.map(k => [k.ticker, k.years]),
  ...DIVIDEND_ARISTOCRATS.map(a => [a.ticker, a.years]),
])

export const TIER_MAP: Record<string, UniverseTier> = (() => {
  const kingSet = new Set(DIVIDEND_KINGS.map(k => k.ticker))
  const aristocratSet = new Set(DIVIDEND_ARISTOCRATS.map(a => a.ticker))
  const map: Record<string, UniverseTier> = {}
  for (const t of kingSet) map[t] = aristocratSet.has(t) ? 'both' : 'king'
  for (const t of aristocratSet) if (!kingSet.has(t)) map[t] = 'aristocrat'
  return map
})()
