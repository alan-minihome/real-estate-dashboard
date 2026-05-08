'use client'

export default function BookPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">📖 배당주로 연봉벌기</h1>
          <p className="text-sm text-[#64748B] mt-1">저자: 애찌 (@upplan0413) · 79p 전자책 핵심 정리</p>
        </div>
        <div className="text-right text-xs text-[#94A3B8]">
          <p>정리일 2026-05-01</p>
          <p>대시보드 설계 기준 원본</p>
        </div>
      </div>

      {/* 저자 실적 */}
      <section className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#0F172A] mb-3">📊 저자 실적 (2025년 기준)</h2>
        <div className="grid grid-cols-4 gap-4 text-center">
          {[
            { label: '연간 배당 수령', value: '402만원' },
            { label: '투자배당률', value: '1.87%' },
            { label: '투자 원금', value: '약 2.4억' },
            { label: '총수익률', value: '26%', sub: 'S&P500 상회' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white rounded-lg p-3 border border-white/80">
              <p className="text-[10px] text-[#64748B] mb-1">{label}</p>
              <p className="text-lg font-bold text-emerald-700">{value}</p>
              {sub && <p className="text-[10px] text-[#94A3B8]">{sub}</p>}
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <p className="text-xs text-[#64748B] bg-white/60 rounded-lg px-3 py-2">
            🎯 목표 ① 연간 배당 2,000만원 (분리과세 한도)
          </p>
          <p className="text-xs text-[#64748B] bg-white/60 rounded-lg px-3 py-2">
            🎯 목표 ② S&P500 장기 수익률 지속 상회
          </p>
        </div>
      </section>

      {/* 핵심 철학 */}
      <section>
        <h2 className="text-base font-semibold text-[#0F172A] mb-3">💡 핵심 철학</h2>
        <div className="space-y-2">
          {[
            '"주식은 나무고, 배당은 그림자"',
            '"앞으로도 돈을 잘 벌 수 있는 기업을 고르는 것이 먼저"',
            '"자본소득이 근로소득을 넘어서는 날이 개인의 독립기념일이다" — 김승호 회장',
          ].map(q => (
            <blockquote key={q} className="border-l-4 border-emerald-400 pl-4 py-1 text-sm text-[#0F172A] italic bg-slate-50 rounded-r-lg">
              {q}
            </blockquote>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[#64748B]">
          <div className="bg-slate-50 rounded-lg p-2.5">📌 주식은 사고파는 것이 아니라 <strong>모아가는 것</strong></div>
          <div className="bg-slate-50 rounded-lg p-2.5">📌 배당성장주는 <strong>꾸준히 모아가기</strong> (사팔사팔 금지)</div>
          <div className="bg-slate-50 rounded-lg p-2.5">📌 <strong>분할 매수, 분할 매도</strong>가 기본</div>
        </div>
      </section>

      {/* 포트폴리오 비중 원칙 */}
      <section>
        <h2 className="text-base font-semibold text-[#0F172A] mb-3">⚖️ 포트폴리오 비중 원칙</h2>
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E2E8F0]">
                <th className="text-left px-4 py-2.5 font-medium text-[#64748B]">구분</th>
                <th className="text-left px-4 py-2.5 font-medium text-[#64748B]">배당률</th>
                <th className="text-left px-4 py-2.5 font-medium text-[#64748B]">특징</th>
                <th className="text-center px-4 py-2.5 font-medium text-[#64748B]">권장 비중</th>
                <th className="text-left px-4 py-2.5 font-medium text-[#64748B]">예시 종목</th>
              </tr>
            </thead>
            <tbody>
              {[
                { type: '배당성장주', yield: '1~2%', desc: '높은 주가 상승 + 배당 성장', weight: '핵심 50%+', cls: 'text-emerald-700 font-semibold', examples: 'AAPL, MSFT, MA, MCO, GOOGL' },
                { type: '중배당주',   yield: '3~5%', desc: '배당 + 주가 상승 균형',     weight: '20~30%',   cls: 'text-blue-700',              examples: 'O, ABBV, JNJ, CVX, SCHD' },
                { type: '고배당주',   yield: '6%+',  desc: '주가 상승 어려움',           weight: '20% 이내', cls: 'text-amber-700',             examples: 'MO, GOF, GPIQ' },
                { type: '성장주',     yield: '없음', desc: '전체 성장 집중',             weight: '20% 이내', cls: 'text-slate-500',             examples: 'NVDA, AMZN 등' },
              ].map(r => (
                <tr key={r.type} className="border-b border-[#E2E8F0] last:border-0">
                  <td className={`px-4 py-3 ${r.cls}`}>{r.type}</td>
                  <td className="px-4 py-3 text-[#0F172A]">{r.yield}</td>
                  <td className="px-4 py-3 text-[#64748B] text-xs">{r.desc}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      r.type === '배당성장주' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>{r.weight}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{r.examples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#94A3B8] mt-2">※ 섹터 분산 필수 — 같은 섹터 내 다종목은 진짜 분산이 아님. 30대는 고배당주 제외 고려.</p>
      </section>

      {/* 저자 추천 5종목 */}
      <section>
        <h2 className="text-base font-semibold text-[#0F172A] mb-1">💎 저자 최추천 5종목 — 강력한 경제적 해자(Moat)</h2>
        <p className="text-xs text-[#94A3B8] mb-3">공통점: S&P500 장기 시장수익률 상회 확인 / 배당 꾸준히 성장 중</p>
        <div className="grid grid-cols-5 gap-3">
          {[
            { ticker: 'MSFT', name: '마이크로소프트', moat: '엑셀·파워포인트·윈도우 → 대체 불가 습관성 소프트웨어', color: 'border-blue-300 bg-blue-50' },
            { ticker: 'MCO',  name: '무디스',         moat: 'S&P와 신용평가 시장 양분. 무디스 등급 없이 채권 발행 불가', color: 'border-amber-300 bg-amber-50' },
            { ticker: 'AAPL', name: '애플',           moat: '아이폰·맥북·애플워치 생태계 → 망할 확률 매우 낮음', color: 'border-slate-300 bg-slate-50' },
            { ticker: 'GOOGL',name: '알파벳',         moat: '유튜브·검색·G메일·제미나이 → 전세계 디지털 광고 압도', color: 'border-emerald-300 bg-emerald-50' },
            { ticker: 'MA',   name: '마스터카드',     moat: '외국 결제 시 Visa 또는 Mastercard 필수. 현금 없는 시대', color: 'border-red-300 bg-red-50' },
          ].map(s => (
            <div key={s.ticker} className={`rounded-xl border-2 ${s.color} p-3 text-center`}>
              <p className="text-base font-bold text-[#0F172A]">{s.ticker}</p>
              <p className="text-[10px] text-[#64748B] mb-2">{s.name}</p>
              <p className="text-[10px] text-[#64748B] leading-snug text-left">{s.moat}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 종목 선별 기준 */}
      <section>
        <h2 className="text-base font-semibold text-[#0F172A] mb-3">🔍 종목 선별 기준 (스크리너 기반)</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            {[
              '배당성향 ≤ 70%',
              '5년 배당성장률 > 0% (우상향)',
              '위기 4회(2000·2008·2018·2020) 배당 삭감 없거나 회복',
              'FCF 양수 + 우상향',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-[#0F172A] bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[
              'EPS 5년 우상향',
              '매출액 5년 우상향',
              '주식수 감소 (자사주 매입)',
              '강력한 경제적 해자 보유',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-[#0F172A] bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 매수·매도 타이밍 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 매수 */}
        <section className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-emerald-800 mb-3">⚡ 매수 타이밍 신호</h2>
          <div className="space-y-2 text-xs text-emerald-900">
            <div className="bg-white/70 rounded-lg px-3 py-2">
              <strong>고·중배당주</strong><br/>현재 배당수익률 &gt; 5년 평균 배당수익률
            </div>
            <div className="bg-white/70 rounded-lg px-3 py-2">
              <strong>배당성장주</strong><br/>매달 분할매수 (타이밍 무관)
            </div>
            <div className="bg-white/70 rounded-lg px-3 py-2">
              <strong>위기 시</strong><br/>배당성장주 집중 매수 기회
            </div>
          </div>
        </section>

        {/* 매도 */}
        <section className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-red-800 mb-3">🚨 매도 신호 (현금 비중 확대)</h2>
          <div className="space-y-2 text-xs text-red-900">
            <div className="bg-white/70 rounded-lg px-3 py-2">
              <strong>장단기 금리차 역전</strong> 후 반년~1년<br/>
              <span className="text-red-600">확인: FRED → T10Y2Y</span>
            </div>
            <div className="bg-white/70 rounded-lg px-3 py-2">
              <strong>미국 소매판매 + 중국 PPI</strong> 수개월 동반 상승<br/>
              <span className="text-red-600">물가 → 금리인상 선행 신호</span>
            </div>
            <div className="bg-white/70 rounded-lg px-3 py-2">
              <strong>실업률</strong> 전월대비 0.5%p+ 급등<br/>
              <span className="text-red-600">확인: FRED → UNRATE</span>
            </div>
          </div>
        </section>
      </div>

      {/* 증시 폭락 신호 — 금리차 역전 역사 */}
      <section>
        <h2 className="text-base font-semibold text-[#0F172A] mb-1">📉 장단기 금리차 역전 역사</h2>
        <p className="text-xs text-[#94A3B8] mb-3">"금리에 증시의 운명이 달려있다" — 역전 후 반년~1년 후부터 보수적 투자</p>
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E2E8F0]">
                {['역전 발생', '실제 침체', '시차', '사건'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-[#64748B]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['1988년 12월', '1990년 7월', '19개월', '걸프전·유가 급등'],
                ['2000년 2월',  '2001년 3월', '13개월', '닷컴버블 붕괴'],
                ['2006년 2월',  '2007년 12월','22개월', '글로벌 금융위기'],
                ['2019년 8월',  '2020년 2월', '6개월',  '코로나19'],
                ['2022년 7월',  '미정',       '진행 중', '고물가·고금리'],
              ].map(([inv, rec, lag, event]) => (
                <tr key={inv} className="border-b border-[#E2E8F0] last:border-0">
                  <td className="px-4 py-2.5 font-medium text-red-600">{inv}</td>
                  <td className="px-4 py-2.5 text-[#0F172A]">{rec}</td>
                  <td className="px-4 py-2.5 text-[#64748B]">{lag}</td>
                  <td className="px-4 py-2.5 text-[#64748B]">{event}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 핵심 개념 */}
      <section>
        <h2 className="text-base font-semibold text-[#0F172A] mb-3">📚 핵심 개념</h2>
        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            { term: '배당수익률', def: '(1년간 주당배당금 ÷ 주가) × 100' },
            { term: '세후 배당수익률', def: '미국 배당소득세 15% 차감 후 실수령' },
            { term: '진짜 수익률', def: '(시세차익 + 누적배당금) ÷ 매수금액 × 100' },
            { term: '배당락일 (Ex-Div)', def: '배당락일 1영업일 전까지 매수 (한국 투자자: 2영업일 전)' },
            { term: '분리과세 한도', def: '연간 배당 2,000만원 이하 → 분리과세. 초과 시 종합소득세' },
            { term: '72법칙', def: '72 ÷ 수익률(%) = 자산 2배 되는 연수 (수익률 26% → 2.7년)' },
            { term: '배당성취', def: '10년+ 연속 배당 증가 종목' },
            { term: '배당귀족', def: '25년+ 연속 배당 증가 종목' },
            { term: '배당킹', def: '50년+ 연속 배당 증가 종목' },
          ].map(({ term, def }) => (
            <div key={term} className="bg-slate-50 rounded-lg p-3 border border-[#E2E8F0]">
              <p className="font-semibold text-[#0F172A] mb-1">{term}</p>
              <p className="text-[#64748B] leading-snug">{def}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 유용한 사이트 */}
      <section>
        <h2 className="text-base font-semibold text-[#0F172A] mb-3">🔗 유용한 사이트</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: '시킹알파',     url: 'https://seekingalpha.com',                             desc: '배당 삭감 이력 · 5년 평균 배당률 · 배당성향' },
            { name: '스톡어날리시스', url: 'https://stockanalysis.com',                           desc: '매출·EPS·FCF·배당성장·주식수 확인' },
            { name: 'SecForm4',    url: 'https://secform4.com',                                  desc: '내부자 매수 정보 (피터 린치 방법)' },
            { name: '데이터로마',   url: 'https://dataroma.com',                                  desc: '투자대가 포트폴리오 (3개월 시차)' },
            { name: 'FRED',        url: 'https://fred.stlouisfed.org',                           desc: '장단기 금리차(T10Y2Y) · 실업률(UNRATE)' },
            { name: '인베스팅닷컴', url: 'https://kr.investing.com/economic-calendar',            desc: '미국 소매판매 · 중국 PPI (폭락 선행지표)' },
            { name: 'Finviz',      url: 'https://finviz.com',                                    desc: 'EPS 성장률 예측 (무료) · 섹터 분석' },
            { name: '도미노 앱',   url: '#',                                                      desc: '연간 배당금(월별) · 종목별 배당금 모바일 확인' },
          ].map(({ name, url, desc }) => (
            <a
              key={name}
              href={url !== '#' ? url : undefined}
              target={url !== '#' ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="flex items-start gap-3 bg-slate-50 hover:bg-slate-100 border border-[#E2E8F0] rounded-lg px-3 py-2.5 transition-colors cursor-pointer"
            >
              <span className="text-[#1A56DB] font-semibold text-xs w-24 shrink-0 mt-0.5">{name}</span>
              <span className="text-xs text-[#64748B] leading-snug">{desc}</span>
            </a>
          ))}
        </div>
      </section>

      {/* 저자 포트폴리오 */}
      <section>
        <h2 className="text-base font-semibold text-[#0F172A] mb-1">💼 저자 현재 포트폴리오 (25.12.28 기준)</h2>
        <p className="text-xs text-[#94A3B8] mb-3">참고용 — 대시보드 홈의 저자 추천 종목과 연동됨</p>
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E2E8F0]">
                {['종목', '유형', '수량', '평균단가', '현재가(25.12)', '수익률', '배당월'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 font-medium text-[#64748B] text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { t:'GOOGL', type:'배당성장', q:37,     avg:'$203.76', cur:'$313.51', ret:'+53.68%', months:'3/6/9/12', pos:true },
                { t:'AMAT',  type:'배당성장', q:67,     avg:'$174.65', cur:'$261.90', ret:'+49.78%', months:'3/6/9/12', pos:true },
                { t:'JNJ',   type:'배당성장', q:20,     avg:'$145.47', cur:'$207.63', ret:'+42.55%', months:'3/6/9/12', pos:true },
                { t:'AAPL',  type:'배당성장', q:84.26,  avg:'$202.44', cur:'$273.40', ret:'+34.88%', months:'2/5/8/11', pos:true },
                { t:'MA',    type:'배당성장', q:15,     avg:'$488.91', cur:'$579.60', ret:'+18.39%', months:'2/5/8/11', pos:true },
                { t:'MSFT',  type:'배당성장', q:3,      avg:'$420.81', cur:'$487.71', ret:'+15.74%', months:'3/6/9/12', pos:true },
                { t:'MCO',   type:'배당성장', q:57,     avg:'$449.74', cur:'$520.04', ret:'+15.47%', months:'3/6/9/12', pos:true },
                { t:'SCHD',  type:'ETF',      q:305.92, avg:'$24.60',  cur:'$27.64',  ret:'+12.20%', months:'3/6/9/12', pos:true },
                { t:'O',     type:'중배당',   q:397,    avg:'$54.39',  cur:'$56.69',  ret:'+4.08%',  months:'매월',     pos:true },
                { t:'SBUX',  type:'중배당',   q:114,    avg:'$76.60',  cur:'$85.08',  ret:'+10.91%', months:'2/5/8/11', pos:true },
                { t:'CVX',   type:'중배당',   q:30,     avg:'$153.72', cur:'$150.02', ret:'-2.54%',  months:'3/6/9/12', pos:false },
              ].map(r => (
                <tr key={r.t} className="border-b border-[#E2E8F0] last:border-0 hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 font-bold text-[#1A56DB]">{r.t}</td>
                  <td className="px-3 py-2.5 text-xs text-[#64748B]">{r.type}</td>
                  <td className="px-3 py-2.5 text-[#0F172A]">{r.q}</td>
                  <td className="px-3 py-2.5 text-[#64748B]">{r.avg}</td>
                  <td className="px-3 py-2.5 text-[#0F172A]">{r.cur}</td>
                  <td className={`px-3 py-2.5 font-medium ${r.pos ? 'text-emerald-600' : 'text-red-500'}`}>{r.ret}</td>
                  <td className="px-3 py-2.5 text-xs text-[#64748B]">{r.months}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
