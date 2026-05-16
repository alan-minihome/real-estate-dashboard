'use client'
import { useState } from 'react'

export default function RegistryPage() {
  const [addresses, setAddresses] = useState('')
  const [generated, setGenerated] = useState(false)

  const lines = addresses.split('\n').map(l => l.trim()).filter(Boolean)

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">등기부등본 자동화</h1>
      <p className="text-xs text-gray-500 mb-6">인터넷등기소(IROS) 장바구니 자동화 안내 — 로그인·결제는 사용자가 직접 수행</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold mb-3">사전 준비사항</h2>
            <ol className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2"><span className="text-blue-500 font-bold shrink-0">1.</span>
                <span>TouchEn nxKey 보안 프로그램 설치 (인터넷등기소 접속 전 필수)</span>
              </li>
              <li className="flex gap-2"><span className="text-blue-500 font-bold shrink-0">2.</span>
                <span>인터넷등기소 로그인 (공동인증서 또는 간편인증)</span>
              </li>
              <li className="flex gap-2"><span className="text-blue-500 font-bold shrink-0">3.</span>
                <span>아래에 주소 목록 입력 → 클라우드 에이전트가 장바구니에 자동으로 담아줌</span>
              </li>
              <li className="flex gap-2"><span className="text-blue-500 font-bold shrink-0">4.</span>
                <span>10만원 미만 일괄결제 → 일괄열람·저장은 IROS 웹 UI에서 직접</span>
              </li>
            </ol>
          </div>

          <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
            <h3 className="font-semibold text-orange-800 mb-2 text-sm">Hard Limits</h3>
            <ul className="text-xs text-orange-700 space-y-1">
              <li>• 에이전트가 ID/PW, 인증서 비밀번호, 카드번호를 입력·저장하지 않습니다</li>
              <li>• 결제는 반드시 사용자가 직접 수행합니다</li>
              <li>• 법적 권리관계 해석·자문을 제공하지 않습니다</li>
              <li>• 법인 결제는 10건 단위 제약이 있습니다</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold mb-3">주소 목록 입력</h2>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm h-40 resize-none font-mono"
              placeholder={"서울 강남구 삼성동 1\n서울 마포구 합정동 5-1\n경기 성남시 분당구 정자동 10"}
              value={addresses}
              onChange={e => setAddresses(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">한 줄에 주소 1개 · {lines.length}건 입력됨</p>

            {lines.length > 0 && (
              <button
                onClick={() => setGenerated(true)}
                className="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg text-sm"
              >
                에이전트 명령어 생성
              </button>
            )}
          </div>

          {generated && lines.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold mb-3">생성된 에이전트 명령</h2>
              <p className="text-xs text-gray-500 mb-2">Claude Code에서 아래 명령을 실행하세요:</p>
              <pre className="bg-gray-50 rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap">
{`인터넷등기소(https://www.iros.go.kr)에서 아래 주소들을
부동산등기부등본 장바구니에 담아줘.
로그인은 이미 완료된 상태야.

${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}

iros-registry-automation 스킬을 참고해서 진행해줘.`}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(
                  `인터넷등기소(https://www.iros.go.kr)에서 아래 주소들을 부동산등기부등본 장바구니에 담아줘.\n로그인은 이미 완료된 상태야.\n\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n\niros-registry-automation 스킬을 참고해서 진행해줘.`
                )}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                클립보드에 복사
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold mb-3">인터넷등기소 바로가기</h2>
            <a
              href="https://www.iros.go.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm"
            >
              인터넷등기소 열기 ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
