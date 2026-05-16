import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: '부동산 대시보드',
  description: '실거래가·경매·청약·법령·뉴스 통합 조회',
}

const NAV = [
  { href: '/', label: '홈' },
  { href: '/transactions', label: '실거래가' },
  { href: '/subscription', label: 'LH 청약' },
  { href: '/auction', label: '법원 경매' },
  { href: '/land-price', label: '공시지가' },
  { href: '/daangn', label: '당근부동산' },
  { href: '/registry', label: '등기부등본' },
  { href: '/news', label: '부동산 뉴스' },
  { href: '/law', label: '법령 검색' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-1 overflow-x-auto">
            <span className="font-bold text-blue-600 mr-3 shrink-0">🏠 부동산</span>
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-md text-sm whitespace-nowrap hover:bg-gray-100 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
