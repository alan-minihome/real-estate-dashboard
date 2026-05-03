'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MENUS = [
  { href: '/',          label: '홈',           icon: '💰' },
  { href: '/portfolio', label: '포트폴리오',    icon: '📊' },
  null, // 구분선
  { href: '/discover',   label: '신규 발굴',    icon: '🔭' },
  { href: '/screener',  label: '종목 스크리너', icon: '🔍' },
  { href: '/candidates', label: '예비 후보함',  icon: '📋' },
  { href: '/simulation', label: '배당 시뮬레이션', icon: '🧮' },
  null, // 구분선
  { href: '/signals',   label: '매수 신호',    icon: '⚡' },
  { href: '/calendar',  label: '배당 캘린더',  icon: '📅' },
  { href: '/macro',     label: '거시경제',     icon: '🌍' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 min-h-screen bg-[var(--dd-sidebar)] flex flex-col fixed left-0 top-0 z-10">
      {/* 로고 */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--dd-blue)] flex items-center justify-center text-white text-sm font-bold">💰</div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">배당주 대시보드</p>
            <p className="text-[10px] text-slate-400 leading-tight">미국 배당성장주 모니터링</p>
          </div>
        </div>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {MENUS.map((item, i) => {
          if (!item) return <div key={`sep-${i}`} className="my-1 border-t border-white/10" />
          const { href, label, icon } = item
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-[var(--dd-blue)] text-white'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* 하단 */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-[10px] text-slate-500">2주 단위 자동 갱신</p>
      </div>
    </aside>
  )
}
