// 저자(『배당주로 연봉벌기』) 추천 종목
// 출처: referfiles/배당주로-연봉벌기-핵심정리.md

export interface AuthorPick {
  ticker: string
  name: string
  category: string
  note?: string
}

// 저자 본인 보유 포트폴리오 (25.12.28 기준)
export const AUTHOR_PORTFOLIO: AuthorPick[] = [
  { ticker: 'MSFT',  name: '마이크로소프트', category: '핵심', note: '저자 5대 핵심 · IT/소프트웨어' },
  { ticker: 'MCO',   name: '무디스',         category: '핵심', note: '저자 5대 핵심 · 금융서비스' },
  { ticker: 'AAPL',  name: '애플',           category: '핵심', note: '저자 5대 핵심 · 생태계 독점' },
  { ticker: 'GOOGL', name: '알파벳',         category: '핵심', note: '저자 5대 핵심 · 24년 배당개시' },
  { ticker: 'MA',    name: '마스터카드',     category: '핵심', note: '저자 5대 핵심 · 결제망' },
  { ticker: 'SCHD',  name: 'Schwab 배당 ETF', category: '보유', note: '배당성장 ETF' },
  { ticker: 'SBUX',  name: '스타벅스',        category: '보유', note: '5년 배당성장 7.84%' },
  { ticker: 'O',     name: '리얼티인컴',      category: '보유', note: '월배당 리츠' },
  { ticker: 'CVX',   name: '쉐브론',          category: '보유', note: '에너지 중배당' },
  { ticker: 'AMAT',  name: '어플라이드 머티리얼스', category: '보유', note: '반도체 장비' },
  { ticker: 'JNJ',   name: '존슨앤존슨',      category: '보유', note: '헬스케어 배당귀족' },
]

// 카테고리별 추천 (3억 포트폴리오 예시)
export const PORTFOLIO_TEMPLATE: AuthorPick[] = [
  { ticker: 'MO',   name: '알트리아',  category: '고배당', note: '비중 20% / 수익률 10%' },
  { ticker: 'GOF',  name: 'Guggenheim Strategic', category: '고배당' },
  { ticker: 'GPIQ', name: 'Goldman Sachs NDX',    category: '고배당' },
  { ticker: 'O',    name: '리얼티인컴', category: '중배당', note: '비중 30% / 수익률 5%' },
  { ticker: 'ABBV', name: '애브비',     category: '중배당' },
  { ticker: 'XOM',  name: '엑슨모빌',   category: '중배당' },
  { ticker: 'V',    name: '비자',       category: '배당성장', note: '비중 50% / 수익률 1.5%' },
  { ticker: 'AAPL', name: '애플',       category: '배당성장' },
  { ticker: 'SBUX', name: '스타벅스',   category: '배당성장' },
]

// 배당월 매핑 (책 정리본 + 일반 알려진 미국 종목 배당 스케줄)
// 형식: '매월' | '1/4/7/10' | '2/5/8/11' | '3/6/9/12'
export const DIV_MONTHS_MAP: Record<string, string> = {
  // 매월 배당 리츠
  'O':    '매월', 'STAG': '매월', 'MAIN': '매월', 'AGNC': '매월',
  // 1/4/7/10
  'KO':   '1/4/7/10', 'PG':   '1/4/7/10', 'JPM':  '1/4/7/10', 'WMT':  '1/4/7/10',
  'CVX':  '1/4/7/10', 'PEP':  '1/4/7/10',
  // 2/5/8/11
  'AAPL': '2/5/8/11', 'MA':   '2/5/8/11', 'SBUX': '2/5/8/11', 'COST': '2/5/8/11',
  'NKE':  '2/5/8/11', 'V':    '2/5/8/11', 'BAC':  '2/5/8/11',
  // 3/6/9/12 (가장 흔한 패턴)
  'MSFT': '3/6/9/12', 'MCO':  '3/6/9/12', 'GOOGL':'3/6/9/12', 'AMAT': '3/6/9/12',
  'JNJ':  '3/6/9/12', 'SCHD': '3/6/9/12', 'AVGO': '3/6/9/12', 'UNH':  '3/6/9/12',
  'BR':   '3/6/9/12', 'AXP':  '3/6/9/12', 'BLK':  '3/6/9/12', 'IBM':  '3/6/9/12',
  'ABT':  '3/6/9/12', 'MMM':  '3/6/9/12', 'XOM':  '3/6/9/12', 'TGT':  '3/6/9/12',
  'OXY':  '3/6/9/12', 'AMGN': '3/6/9/12', 'KHC':  '3/6/9/12',
}

// 4대 가치투자 대가 공통 보유 (책 6장)
export const SUPER_INVESTOR_COMMON: AuthorPick[] = [
  { ticker: 'AAPL',  name: '애플',         category: '대가공통', note: '버핏·그랜덤 보유' },
  { ticker: 'MSFT',  name: '마이크로소프트', category: '대가공통', note: '약트먼·그랜덤 보유' },
  { ticker: 'GOOGL', name: '알파벳',       category: '대가공통', note: '버핏·약트먼·그랜덤 보유' },
  { ticker: 'KO',    name: '코카콜라',      category: '대가공통', note: '버핏·약트먼 보유' },
  { ticker: 'V',     name: '비자',         category: '대가공통', note: '아크레·그랜덤 보유' },
  { ticker: 'MA',    name: '마스터카드',    category: '대가공통', note: '아크레 핵심 종목' },
  { ticker: 'MCO',   name: '무디스',       category: '대가공통', note: '버핏·아크레 보유' },
]
