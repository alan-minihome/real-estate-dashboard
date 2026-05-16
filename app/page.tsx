import Link from 'next/link'

const FEATURES = [
  {
    href: '/transactions',
    icon: '📊',
    title: '실거래가 조회',
    desc: '아파트·오피스텔·빌라·단독주택 실거래가 및 전월세 추이. 면적·층수 디테일 포함.',
    badge: 'API 키 불필요',
  },
  {
    href: '/subscription',
    icon: '🏗️',
    title: 'LH 청약 공고',
    desc: '영구임대·국민임대·분양주택 등 LH 청약 공고를 상태·지역·유형별로 필터링.',
    badge: 'API 키 불필요',
  },
  {
    href: '/auction',
    icon: '⚖️',
    title: '법원 경매',
    desc: '법원 경매 공고를 매각기일·법원·지역·가격대로 검색. 사건번호 직접 조회 지원.',
    badge: '세션당 10회 제한',
    badgeColor: 'bg-orange-100 text-orange-700',
  },
  {
    href: '/land-price',
    icon: '📋',
    title: '공시지가',
    desc: '개별공시지가 연도별 추이 및 전년 대비 등락률. 재산세·양도소득세 기준 확인.',
    badge: 'API 키 불필요',
  },
  {
    href: '/daangn',
    icon: '🥕',
    title: '당근부동산',
    desc: '당근부동산 공개 매물 검색. 지역·유형·거래방식 필터 지원.',
    badge: '읽기 전용',
  },
  {
    href: '/registry',
    icon: '📄',
    title: '등기부등본 자동화',
    desc: '주소 목록을 입력하면 인터넷등기소 장바구니에 자동으로 담아줍니다. 로그인·결제는 직접.',
    badge: '로그인 필요',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
  {
    href: '/news',
    icon: '📰',
    title: '부동산 뉴스',
    desc: '네이버 뉴스에서 부동산 관련 최신 기사를 키워드 검색. 제목·요약·발행시각 제공.',
    badge: 'API 키 불필요',
  },
  {
    href: '/law',
    icon: '⚖️',
    title: '법령 검색',
    desc: '부동산 관련 법령·조문·판례를 빠르게 탐색. 주택법·공인중개사법·민법 등.',
    badge: 'MCP 연동',
    badgeColor: 'bg-green-100 text-green-700',
  },
]

export default function HomePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">부동산 대시보드</h1>
        <p className="text-gray-500 text-sm">실거래가·경매·청약·법령·뉴스를 한 곳에서 조회합니다.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {FEATURES.map(({ href, icon, title, desc, badge, badgeColor }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition-all group"
          >
            <div className="text-2xl mb-3">{icon}</div>
            <h2 className="font-semibold mb-1 group-hover:text-blue-600 transition-colors">{title}</h2>
            <p className="text-gray-500 text-xs leading-relaxed mb-3">{desc}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor ?? 'bg-blue-100 text-blue-700'}`}>
              {badge}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
