'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MENUS = [
  { href: '/', label: '홈', icon: '🏠' },
  null,
  { label: '시세 조회', group: true },
  { href: '/transactions', label: '실거래가', icon: '📊' },
  { href: '/land-price',   label: '공시지가', icon: '📋' },
  null,
  { label: '매물 탐색', group: true },
  { href: '/subscription', label: 'LH 청약',   icon: '🏗️' },
  { href: '/auction',      label: '법원 경매',  icon: '⚖️' },
  { href: '/daangn',       label: '당근부동산', icon: '🥕' },
  null,
  { label: '문서·정보', group: true },
  { href: '/registry',     label: '등기부등본',  icon: '📄' },
  { href: '/news',         label: '부동산 뉴스', icon: '📰' },
  { href: '/law',          label: '법령 검색',   icon: '⚖️' },
] as const

type MenuItem =
  | { href: string; label: string; icon: string; group?: never }
  | { label: string; group: true; href?: never; icon?: never }
  | null

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="w-56 h-screen flex flex-col fixed left-0 top-0 z-10"
      style={{ background: 'var(--dd-sidebar)' }}
    >
      {/* 로고 */}
      <div className="px-5 py-5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: 'var(--dd-blue)' }}
          >
            🏠
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">부동산 대시보드</p>
            <p className="text-[10px] leading-tight" style={{ color: 'var(--dd-sidebar-text)' }}>
              실거래가·경매·청약·법령
            </p>
          </div>
        </div>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-0.5">
        {(MENUS as readonly (MenuItem)[]).map((item, i) => {
          if (!item) {
            return <div key={`sep-${i}`} className="my-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
          }
          if ('group' in item && item.group) {
            return (
              <p key={item.label} className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(168,196,224,0.5)' }}>
                {item.label}
              </p>
            )
          }
          const { href, label, icon } = item as { href: string; label: string; icon: string }
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={active
                ? { background: 'var(--dd-blue)', color: '#ffffff' }
                : { color: 'var(--dd-sidebar-text)' }
              }
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span className="text-base">{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* 하단 */}
      <div className="px-4 py-4 shrink-0 text-[10px]" style={{ color: 'rgba(168,196,224,0.35)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p>무료 공공 API 기반</p>
        <p className="mt-0.5">실시간 데이터 · 캐시 적용</p>
      </div>
    </aside>
  )
}
