import Link from 'next/link'

interface Props {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
  signal?: boolean
  href?: string
}

export default function KpiCard({ label, value, sub, accent, signal, href }: Props) {
  const base = 'rounded-xl border p-5 transition-all duration-150'
  const interactive = href ? 'cursor-pointer hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5' : ''
  const style = signal
    ? `${base} ${interactive} bg-emerald-50 border-emerald-200`
    : accent
    ? `${base} ${interactive} bg-[var(--dd-blue-light)] border-[var(--dd-border-subtle)]`
    : `${base} ${interactive} bg-[var(--dd-surface)] border-[var(--dd-border)] shadow-[var(--shadow-card)]`

  const inner = (
    <>
      <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${signal ? 'text-emerald-600' : 'text-[var(--dd-muted)]'}`}>{label}</p>
      <p className={`text-3xl font-bold tabular ${signal ? 'text-emerald-700' : accent ? 'text-[var(--dd-blue)]' : 'text-[var(--dd-text)]'}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${signal ? 'text-emerald-600' : 'text-[var(--dd-muted)]'}`}>{sub}</p>}
      {href && <p className={`text-[10px] mt-2 ${signal ? 'text-emerald-500' : 'text-[var(--dd-text-2)]'}`}>자세히 보기 →</p>}
    </>
  )

  if (href) {
    return <Link href={href} className={style}>{inner}</Link>
  }

  return <div className={style}>{inner}</div>
}
