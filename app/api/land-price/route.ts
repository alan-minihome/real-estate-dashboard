import { NextRequest, NextResponse } from 'next/server'
import { cacheGet, cacheSet, saveHistory } from '@/lib/db'

const BASE = 'https://www.realtyprice.kr/notice'
const REFERER = 'https://www.realtyprice.kr/notice/gsindividual/search.htm'
const HEADERS = { 'Referer': REFERER, 'User-Agent': 'Mozilla/5.0' }

const SIDO_MAP: Record<string, string> = {
  '서울': '11', '서울특별시': '11',
  '부산': '21', '부산광역시': '21',
  '대구': '22', '대구광역시': '22',
  '인천': '23', '인천광역시': '23',
  '광주': '24', '광주광역시': '24',
  '대전': '25', '대전광역시': '25',
  '울산': '26', '울산광역시': '26',
  '세종': '29', '세종특별자치시': '29',
  '경기': '31', '경기도': '31',
  '강원': '32', '강원도': '32', '강원특별자치도': '32',
  '충북': '33', '충청북도': '33',
  '충남': '34', '충청남도': '34',
  '전북': '35', '전라북도': '35', '전북특별자치도': '35',
  '전남': '36', '전라남도': '36',
  '경북': '37', '경상북도': '37',
  '경남': '38', '경상남도': '38',
  '제주': '39', '제주특별자치도': '39',
}

function parseAddress(address: string) {
  const parts = address.trim().split(/\s+/)
  if (parts.length < 3) return null

  const sidoRaw = parts[0]
  const sidoCode = SIDO_MAP[sidoRaw]
  if (!sidoCode) return null

  const sigungu = sidoCode === '29' ? '' : parts[1]
  const eupmyeondong = sidoCode === '29' ? parts[1] : parts[2]

  // 지번 파싱 (예: "삼성동 1", "삼성동 산1", "삼성동 1-2")
  let san = '1'; let bun1 = '0001'; let bun2 = '0000'
  const jibunParts = parts.slice(sidoCode === '29' ? 2 : 3)

  if (jibunParts.length > 0) {
    let jibun = jibunParts.join(' ')
    if (jibun.startsWith('산')) { san = '2'; jibun = jibun.slice(1) }
    else { san = '1' }
    const [b1, b2] = jibun.split('-')
    bun1 = String(parseInt(b1) || 1).padStart(4, '0')
    bun2 = String(parseInt(b2) || 0).padStart(4, '0')
  }

  return { sidoCode, sigungu, eupmyeondong, san, bun1, bun2 }
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const address = searchParams.get('address') ?? ''

  if (!address) return NextResponse.json({ error: '주소 필수 (예: 서울 강남구 삼성동 1)' }, { status: 400 })

  const cacheKey = `landprice2:${address.replace(/\s+/g, ' ').trim()}`
  const cached = cacheGet<unknown>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const parsed = parseAddress(address)
  if (!parsed) return NextResponse.json({ error: '주소 파싱 실패. 형식: 시도 시군구 읍면동 지번 (예: 서울 강남구 삼성동 1)' }, { status: 400 })

  try {
    const { sidoCode, sigungu, eupmyeondong, san, bun1, bun2 } = parsed

    // 1. 시군구 코드 조회
    let regCode = ''
    if (sidoCode === '29') {
      regCode = '36110' // 세종시 고정
    } else {
      const sggData = await fetchJson(`${BASE}/bjd/searchBjdApi.bjd?gbn=1&gubun=sgg&sido=${sidoCode}`)
      const sggList: { name: string; reg: string }[] = sggData?.model?.list ?? []
      const sggMatch = sggList.find(s => s.name === sigungu || s.name.replace(/[시군구]/g, '') === sigungu.replace(/[시군구]/g, ''))
      if (!sggMatch) return NextResponse.json({ error: `시군구를 찾을 수 없습니다: ${sigungu}` }, { status: 404 })
      regCode = sggMatch.reg
    }

    // 2. 읍면동 코드 조회
    const eubData = await fetchJson(`${BASE}/bjd/searchBjdApi.bjd?gbn=1&gubun=eub&sido=${sidoCode}&sgg=${regCode}`)
    const eubList: { name: string; eub: string }[] = eubData?.model?.list ?? []
    const eubMatch = eubList.find(e => e.name === eupmyeondong || e.name.startsWith(eupmyeondong))
    if (!eubMatch) return NextResponse.json({ error: `읍면동을 찾을 수 없습니다: ${eupmyeondong}` }, { status: 404 })
    const eubCode = eubMatch.eub

    // 3. 공시지가 조회
    const gsiData = await fetchJson(
      `${BASE}/search/gsiSearchListApi.search?gbn=1&reg=${regCode}&eub=${eubCode}&san=${san}&bun1=${bun1}&bun2=${bun2}&tabGbn=Text&page_no=1&year=`
    )
    const items: { base_year: string; gakuka_w: string; addr: string; jibun: string; notice_ymd: string }[] = gsiData?.model?.list ?? []

    if (items.length === 0) return NextResponse.json({ error: '해당 주소의 공시지가 데이터가 없습니다.' }, { status: 404 })

    // 연도별 정렬 및 정규화
    const history = items
      .map(item => ({
        year: parseInt(item.base_year),
        price_per_sqm: parseInt(item.gakuka_w.replace(/,/g, '')),
        notice_date: item.notice_ymd,
      }))
      .sort((a, b) => b.year - a.year)

    const latest = history[0]
    const prev = history[1]
    const yoy = prev ? ((latest.price_per_sqm - prev.price_per_sqm) / prev.price_per_sqm) * 100 : 0

    const result = {
      address: items[0].addr,
      jibun: items[0].jibun,
      latest: { year: latest.year, price_per_sqm: latest.price_per_sqm, notice_date: latest.notice_date },
      history: history.map(h => ({ year: h.year, price_per_sqm: h.price_per_sqm })),
      yoy_change_pct: Math.round(yoy * 100) / 100,
    }

    cacheSet(cacheKey, result, 24 * 60 * 60 * 1000)
    saveHistory('land-price', address)
    return NextResponse.json(result)

  } catch (err) {
    return NextResponse.json({ error: `조회 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}` }, { status: 502 })
  }
}
