import type { Metadata } from 'next'
import './globals.css'
import AppShell from './components/AppShell'

export const metadata: Metadata = {
  title: '부동산 대시보드',
  description: '실거래가·경매·청약·법령·뉴스 통합 조회',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
