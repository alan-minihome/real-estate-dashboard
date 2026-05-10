import { NextResponse } from 'next/server'
import { getDb, getWriteDb } from '@/lib/db'

function safeParse(v: unknown): Record<string, number | null> {
  if (!v) return {}
  if (typeof v === 'object') return v as Record<string, number | null>
  try { return JSON.parse(v as string) } catch { return {} }
}

export function GET() {
  try {
    const db = getDb()
    // 후보함 + stock_data(최신) + screening_results(최신, 우선) + universe_screening(최신, 폴백)
    // checks_json도 폴백 처리 (개별 기준 ✅❌ 표시용)
    const rows = db.prepare(
      `SELECT
         c.*,
         COALESCE(s.div_yield,  eu.div_yield,  ke.div_yield)  AS div_yield,
         s.div_yield_5y,
         COALESCE(s.price, eu.last_price, ke.last_price)       AS price,
         s.payout_ratio, s.fcf_payout_ratio, s.div_growth_5y, s.peg, s.de_ratio, s.roe, s.eps_growth, s.eps_growth_fwd, s.fcf_yield,
         s.market_cap, s.sector,
         eu.expense_ratio AS etf_expense_ratio,
         ke.expense_ratio AS kr_etf_expense_ratio,
         eu.div_frequency AS etf_div_frequency,
         ke.div_frequency AS kr_etf_div_frequency,
         ke.issuer        AS kr_etf_issuer,
         COALESCE(sc.overall_pass,  us.overall_pass)  AS overall_pass,
         COALESCE(sc.buy_signal,    us.buy_signal)    AS buy_signal,
         COALESCE(sc.signal_reason, us.signal_reason) AS signal_reason,
         us.checks_json AS us_checks_json,
         sc.pass_payout, sc.pass_div_growth, sc.pass_peg, sc.pass_de, sc.pass_roe, sc.pass_eps
       FROM candidates c
       LEFT JOIN (
         SELECT s.ticker, s.div_yield, s.div_yield_5y, s.price,
                s.payout_ratio, s.fcf_payout_ratio, s.div_growth_5y, s.peg, s.de_ratio, s.roe, s.eps_growth, s.eps_growth_fwd, s.fcf_yield,
                s.market_cap, s.sector
         FROM stock_data s
         INNER JOIN (
           SELECT ticker, MAX(fetched_at) ma FROM stock_data GROUP BY ticker
         ) latest ON s.ticker = latest.ticker AND s.fetched_at = latest.ma
       ) s ON c.ticker = s.ticker AND c.asset_type = 'stock'
       LEFT JOIN etf_universe eu ON c.ticker = eu.ticker AND c.asset_type = 'us_etf'
       LEFT JOIN kr_etf_universe ke ON c.ticker = ke.ticker AND c.asset_type = 'kr_etf'
       LEFT JOIN (
         SELECT sr.ticker, sr.overall_pass, sr.buy_signal, sr.signal_reason,
                sr.pass_payout, sr.pass_div_growth, sr.pass_peg, sr.pass_de, sr.pass_roe, sr.pass_eps
         FROM screening_results sr
         INNER JOIN (
           SELECT ticker, MAX(screened_at) ma FROM screening_results GROUP BY ticker
         ) latest ON sr.ticker = latest.ticker AND sr.screened_at = latest.ma
       ) sc ON c.ticker = sc.ticker
       LEFT JOIN (
         SELECT u.ticker, u.overall_pass, u.buy_signal, u.signal_reason, u.checks_json
         FROM universe_screening u
         INNER JOIN (
           SELECT ticker, MAX(screened_at) ma FROM universe_screening GROUP BY ticker
         ) latest ON u.ticker = latest.ticker AND u.screened_at = latest.ma
       ) us ON c.ticker = us.ticker
       WHERE c.status != 'dropped'
       ORDER BY c.added_at DESC`
    ).all() as Array<Record<string, unknown>>

    // legacy pass_* 우선, 없으면 universe_screening의 checks_json에서 폴백
    const result = rows.map(r => {
      const checks = r.us_checks_json ? safeParse(r.us_checks_json) : {}
      // 직렬화 안전한 명시적 객체 반환 (spread 미사용 — checks_json 등 오염 방지)
      return {
        id:              r.id,
        ticker:          r.ticker,
        name:            r.name,
        added_at:        r.added_at,
        target_shares:   r.target_shares,
        memo:            r.memo,
        status:          r.status,
        asset_type:      (r.asset_type ?? 'stock') as string,
        div_yield:       r.div_yield       ?? null,
        div_yield_5y:    r.div_yield_5y    ?? null,
        price:           r.price           ?? null,
        payout_ratio:    r.payout_ratio    ?? null,
        fcf_payout_ratio: r.fcf_payout_ratio ?? null,
        div_growth_5y:   r.div_growth_5y   ?? null,
        peg:             r.peg             ?? null,
        de_ratio:        r.de_ratio        ?? null,
        roe:             r.roe             ?? null,
        eps_growth:      r.eps_growth      ?? null,
        eps_growth_fwd:  r.eps_growth_fwd  ?? null,
        fcf_yield:       r.fcf_yield       ?? null,
        market_cap:      r.market_cap      ?? null,
        sector:          r.sector          ?? null,
        overall_pass:    r.overall_pass    ?? null,
        buy_signal:      r.buy_signal      ?? null,
        signal_reason:   r.signal_reason   ?? null,
        pass_payout:     (r.pass_payout     ?? checks.payout_ratio_max    ?? null) as number | null,
        pass_div_growth: (r.pass_div_growth ?? checks.div_growth_5y_min   ?? null) as number | null,
        pass_peg:        (r.pass_peg        ?? checks.peg_max             ?? null) as number | null,
        pass_de:         (r.pass_de         ?? checks.de_ratio_max        ?? null) as number | null,
        pass_roe:        (r.pass_roe        ?? checks.roe_min             ?? null) as number | null,
        pass_eps:        (r.pass_eps        ?? checks.eps_growth_min      ?? null) as number | null,
        pass_fcf_payout:     checks.fcf_payout_ratio_max ?? null,
        pass_fcf_yield:      checks.fcf_yield_min        ?? null,
        expense_ratio:       (r.etf_expense_ratio ?? r.kr_etf_expense_ratio ?? null) as number | null,
        div_frequency:       (r.etf_div_frequency ?? r.kr_etf_div_frequency ?? null) as string | null,
        issuer:              (r.kr_etf_issuer ?? null) as string | null,
      }
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { ticker, name } = await req.json()
    if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })
    const db = getWriteDb()
    db.prepare(
      `INSERT INTO candidates (ticker, name, added_at, status)
       VALUES (?, ?, ?, 'watching')
       ON CONFLICT(ticker) DO UPDATE SET status='watching', added_at=excluded.added_at`
    ).run(ticker.toUpperCase(), name || ticker, new Date().toISOString())
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
