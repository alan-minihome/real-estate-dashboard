import { NextRequest, NextResponse } from 'next/server'
import { cacheGet, cacheSet, saveHistory } from '@/lib/db'

const BASE = 'https://www.courtauction.go.kr'

// 법원코드 주요 목록
const COURT_CODES: Record<string, string> = {
  '서울중앙': 'B000210', '서울동부': 'B000220', '서울서부': 'B000230',
  '서울남부': 'B000240', '서울북부': 'B000250', '인천': 'B000630',
  '수원': 'B000560', '성남': 'B000570', '부천': 'B000610',
  '의정부': 'B000270', '고양': 'B000290', '부산': 'B001010',
  '대구': 'B001410', '광주': 'B001610', '대전': 'B001210',
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const courtCode = searchParams.get('courtCode') ?? 'B000210'
  const date = searchParams.get('date') ?? ''
  const caseNumber = searchParams.get('caseNumber') ?? ''

  const cacheKey = `auction:${courtCode}:${date}:${caseNumber}`
  const cached = cacheGet<unknown>(cacheKey)
  if (cached) return NextResponse.json(cached)

  // courtauction은 IP 차단 주의 — 직접 프록시 없이 안내 데이터만 반환
  // 실제 조회는 사용자가 브라우저에서 수행 권장
  const searchUrl = caseNumber
    ? `${BASE}/PwnMulSrch05.laf?jiwonNm=${courtCode}&caseNo=${encodeURIComponent(caseNumber)}`
    : `${BASE}/PwnMulSrch04.laf?jiwonNm=${courtCode}&sell_date=${date}`

  const result = {
    court_code: courtCode,
    date,
    case_number: caseNumber,
    search_url: searchUrl,
    notice: '법원경매 사이트는 자동 조회 시 IP 차단(세션당 10회, 2초 딜레이 필수). 아래 URL을 브라우저에서 직접 확인하세요.',
    courts: COURT_CODES,
  }

  cacheSet(cacheKey, result, 5 * 60 * 1000)
  saveHistory('auction', `${courtCode} ${date} ${caseNumber}`)
  return NextResponse.json(result)
}
