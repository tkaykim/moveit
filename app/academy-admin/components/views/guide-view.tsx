"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Palette,
  UserCheck,
  Ticket,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  Megaphone,
  HelpCircle,
  ChevronRight,
  Copy,
  Check,
  PartyPopper,
  ArrowRight,
} from 'lucide-react';
import { useAcademy } from '../../contexts/academy-context';
import { useOnboardingOptional } from '../../contexts/onboarding-context';

interface Section {
  id: string;
  no: number | null;
  title: string;
  icon: typeof Palette;
}

const SECTIONS: Section[] = [
  { id: 'start', no: null, title: '시작하기', icon: Sparkles },
  { id: 'decorate', no: 1, title: '학원 홈 꾸미기', icon: Palette },
  { id: 'instructors', no: 2, title: '강사 등록', icon: UserCheck },
  { id: 'tickets', no: 3, title: '수강권 만들기', icon: Ticket },
  { id: 'classes', no: 4, title: '수업(클래스) 만들기', icon: BookOpen },
  { id: 'schedule', no: 5, title: '수업 일정 배치', icon: CalendarDays },
  { id: 'enrollments', no: 6, title: '신청 · 출석 관리', icon: ClipboardCheck },
  { id: 'payment', no: 7, title: '수강권 간편결제', icon: CreditCard },
  { id: 'promote', no: 8, title: '홍보하기 ★', icon: Megaphone },
  { id: 'faq', no: null, title: '자주 묻는 질문', icon: HelpCircle },
];

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <div className="flex-1 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
        {children}
      </div>
    </li>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-900/40">
      <span aria-hidden className="text-amber-500 text-sm">💡</span>
      <p className="text-xs text-amber-800 dark:text-amber-200/90 leading-relaxed">{children}</p>
    </div>
  );
}

function GoButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 mt-4 px-3.5 py-2 rounded-lg bg-primary text-black text-sm font-semibold hover:opacity-90 transition-opacity"
    >
      {children}
      <ArrowRight className="w-4 h-4" />
    </Link>
  );
}

function CopyTemplate({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [text]);
  return (
    <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      <pre className="px-3 py-3 text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed bg-neutral-50 dark:bg-neutral-800/50">
{text}
      </pre>
      <button
        type="button"
        onClick={onCopy}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-500" /> 복사됨
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" /> 문구 복사
          </>
        )}
      </button>
    </div>
  );
}

function SectionCard({
  section,
  children,
}: {
  section: Section;
  children: React.ReactNode;
}) {
  const Icon = section.icon;
  return (
    <section
      id={section.id}
      className="scroll-mt-24 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 sm:p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
          {section.no !== null && (
            <span className="text-primary mr-1.5">{section.no}.</span>
          )}
          {section.title}
        </h2>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

export function GuideView({ academyId }: { academyId: string }) {
  const { academySlug: slug } = useAcademy();
  const onboarding = useOnboardingOptional();
  const base = `/academy-admin/${slug}`;
  const [activeId, setActiveId] = useState<string>('start');

  // 스크롤 스파이: 현재 보이는 섹션을 목차에서 강조
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/30 p-6 sm:p-8 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-white">
              학원 관리자 사용 가이드
            </h1>
            <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
              처음 오셨다면 위에서 아래로 순서대로 따라오시면 됩니다.
              <br />
              학원 홈 꾸미기부터 회원 홍보까지, 하나씩 끝내면 바로 운영을 시작할 수 있어요.
            </p>
            {onboarding && (
              <button
                type="button"
                onClick={onboarding.startOnboarding}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-primary/50 text-primary text-sm font-semibold hover:bg-primary/10"
              >
                <PartyPopper className="w-4 h-4" />
                화면 따라 둘러보기 시작
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {/* 목차 */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-0.5">
            <p className="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              목차
            </p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeId === s.id
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {s.no !== null && (
                  <span className="text-xs tabular-nums w-4 text-center opacity-70">{s.no}</span>
                )}
                <span className="truncate">{s.title}</span>
              </a>
            ))}
          </nav>
        </aside>

        {/* 본문 */}
        <div className="space-y-5">
          <SectionCard section={SECTIONS[0]}>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              MOVE IT 학원 관리자에 오신 것을 환영합니다.
              <br />
              아래 순서대로 진행하면 누구나 학원을 열 수 있도록 구성했습니다.
            </p>
            <ol className="mt-4 space-y-2.5">
              <Step n={1}>
                <b>학원 홈 꾸미기</b> — 회원에게 보이는 우리 학원 페이지를 채웁니다.
              </Step>
              <Step n={2}>
                <b>강사 등록</b> — 수업을 맡을 강사를 등록합니다.
              </Step>
              <Step n={3}>
                <b>수강권 만들기</b> — 기간제·횟수제·워크샵 수강권과 가격을 만듭니다.
              </Step>
              <Step n={4}>
                <b>수업(클래스) 만들기</b> — 반을 만들고 어떤 수강권으로 들을 수 있는지 연결합니다.
              </Step>
              <Step n={5}>
                <b>수업 일정 배치</b> — 요일·시간 반복 일정을 등록하면 달력이 자동으로 채워집니다.
              </Step>
              <Step n={6}>
                <b>신청 · 출석 관리</b> — 회원 신청을 받고 출석을 관리합니다.
              </Step>
              <Step n={7}>
                <b>홍보하기</b> — 수업·수강권 링크를 복사해 인스타·카톡에 올려 회원을 모읍니다.
              </Step>
            </ol>
            <Tip>
              대시보드 상단의 <b>“학원 오픈 준비”</b> 카드가 이 순서를 진행률(예: 3/6)로 보여줍니다. 실제로 만들면 자동으로 ✓ 표시됩니다.
            </Tip>
          </SectionCard>

          <SectionCard section={SECTIONS[1]}>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              회원이 우리 학원을 검색하면 보게 되는 페이지를 꾸밉니다.
            </p>
            <ol className="mt-4 space-y-2.5">
              <Step n={1}>
                <b>설정 → 학원 정보</b> 탭에서 학원명·주소·연락처·소개글을 입력하고 저장합니다.
              </Step>
              <Step n={2}>
                인스타그램·유튜브·네이버지도·카카오 채널 링크를 넣으면 회원이 바로 연결됩니다.
              </Step>
              <Step n={3}>
                계좌이체로 결제를 받으려면 <b>입금 계좌(은행·계좌번호·예금주)</b>도 입력하세요.
              </Step>
              <Step n={4}>
                <b>설정 → 페이지 구성</b> 탭에서 홈 화면 섹션 순서를 바꾸거나 공지·이벤트 같은 커스텀 섹션을 추가할 수 있습니다.
              </Step>
            </ol>
            <Tip>
              “페이지 구성”을 한 번이라도 저장하면 오픈 준비의 <b>홈 꾸미기</b> 단계가 완료로 표시됩니다.
            </Tip>
            <GoButton href={`${base}/settings`}>설정으로 이동</GoButton>
          </SectionCard>

          <SectionCard section={SECTIONS[2]}>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              수업을 맡을 강사를 먼저 등록해 두면, 클래스와 스케줄에서 선택할 수 있습니다.
            </p>
            <ol className="mt-4 space-y-2.5">
              <Step n={1}>
                <b>강사 관리</b>에서 “강사 추가”로 이름·프로필을 등록합니다.
              </Step>
              <Step n={2}>
                이미 MOVE IT에 등록된 강사라면 검색해서 우리 학원에 연결할 수도 있습니다.
              </Step>
            </ol>
            <GoButton href={`${base}/instructors`}>강사 관리로 이동</GoButton>
          </SectionCard>

          <SectionCard section={SECTIONS[3]}>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              회원이 구매하는 “이용권”입니다. 세 가지 유형이 있습니다.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
              <li><b>기간제</b> — 정해진 기간 동안 무제한/지정 클래스 수강 (예: 1개월 자유수강권)</li>
              <li><b>횟수제(쿠폰)</b> — 정해진 횟수만큼 차감 (예: 10회권)</li>
              <li><b>워크샵(특강)</b> — 단발성 수업 1회 결제</li>
            </ul>
            <ol className="mt-4 space-y-2.5">
              <Step n={1}>
                <b>수강권/상품 → 새 상품 추가</b>에서 이름·가격·기간/횟수·적용 클래스를 정합니다.
              </Step>
              <Step n={2}>
                필요하면 “할인 추가”로 신규·재등록·기간 할인 정책을 설정합니다.
              </Step>
            </ol>
            <Tip>
              수강권을 <b>특정 클래스에 연결</b>해 두면, 그 반 수업에 출석할 때만 차감됩니다.
            </Tip>
            <GoButton href={`${base}/products`}>수강권/상품으로 이동</GoButton>
          </SectionCard>

          <SectionCard section={SECTIONS[4]}>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              클래스(반)는 수업의 기본 단위입니다.
              <br />
              여기서 만든 반을 기준으로 일정(세션)을 깔고, 수강권과 연결합니다.
            </p>
            <ol className="mt-4 space-y-2.5">
              <Step n={1}>
                <b>클래스(반) 관리 → 새 클래스 추가</b>에서 반 이름·장르·난이도·강사·강의실을 정합니다.
              </Step>
              <Step n={2}>
                이 반에서 쓸 수 있는 수강권 유형(정규/팝업/워크샵)을 허용합니다.
              </Step>
            </ol>
            <Tip>
              반을 <b>먼저</b> 만들어야 다음 단계인 스케줄에서 선택할 수 있습니다.
            </Tip>
            <GoButton href={`${base}/class-masters`}>클래스 관리로 이동</GoButton>
          </SectionCard>

          <SectionCard section={SECTIONS[5]}>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              반복 일정을 한 번 등록하면, 매주 같은 요일·시간에 수업이 자동으로 생성됩니다.
              <br />
              매번 하나씩 만들 필요가 없습니다.
            </p>
            <ol className="mt-4 space-y-2.5">
              <Step n={1}>
                <b>스케줄 관리 → 스케줄 생성</b>을 누릅니다.
              </Step>
              <Step n={2}>
                클래스(반), 요일, 시작/종료 시간, 강의실을 정합니다.
              </Step>
              <Step n={3}>
                저장하면 해당 조건의 수업이 달력에 자동으로 채워집니다.
              </Step>
              <Step n={4}>
                개별 날짜의 수업(세션)을 누르면 인원·시간 수정이나 휴강 처리를 할 수 있습니다.
              </Step>
            </ol>
            <Tip>
              특강·워크샵처럼 한 번만 여는 수업은 반복 대신 단일 세션으로 만들 수 있습니다.
            </Tip>
            <GoButton href={`${base}/schedule`}>스케줄 관리로 이동</GoButton>
          </SectionCard>

          <SectionCard section={SECTIONS[6]}>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              회원이 앱에서 신청하면 자동으로 목록에 쌓입니다.
              <br />
              전화·방문으로 신청한 회원은 관리자가 직접 추가할 수 있습니다.
            </p>
            <ol className="mt-4 space-y-2.5">
              <Step n={1}>
                <b>신청인원 관리</b>에서 날짜·수업·상태로 신청 목록을 봅니다.
              </Step>
              <Step n={2}>
                앱으로 신청하지 않은 회원은 <b>“수기 추가”</b>로 직접 등록하고, 사용할 수강권을 지정합니다.
              </Step>
              <Step n={3}>
                현장에서는 <b>QR 출석 리더</b>로 회원이 QR을 찍어 출석할 수 있습니다.
              </Step>
            </ol>
            <GoButton href={`${base}/enrollments`}>신청인원 관리로 이동</GoButton>
          </SectionCard>

          <SectionCard section={SECTIONS[7]}>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              학원에 방문한 회원에게 그 자리에서 수강권을 판매·결제할 수 있습니다.
            </p>
            <ol className="mt-4 space-y-2.5">
              <Step n={1}>
                헤더의 <b>“수강권 간편결제”</b> 또는 매출/정산의 <b>“판매”</b> 탭으로 들어갑니다.
              </Step>
              <Step n={2}>
                회원과 수강권을 선택하고, 할인 적용 후 결제합니다.
              </Step>
              <Step n={3}>
                계좌이체를 받았다면 <b>수동 입금확인</b>에서 입금을 확인 처리합니다.
              </Step>
            </ol>
            <GoButton href={`${base}/revenue?tab=sales`}>간편결제로 이동</GoButton>
          </SectionCard>

          {/* 홍보 — 핵심 섹션 */}
          <section
            id="promote"
            className="scroll-mt-24 rounded-2xl border-2 border-primary/40 bg-primary/[0.04] dark:bg-primary/[0.07] p-5 sm:p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                <span className="text-primary mr-1.5">8.</span>홍보하기 — 회원 모으기 ★
              </h2>
            </div>
            <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
              수업과 수강권을 만들었다면, 이제 알려서 회원을 모을 차례입니다.
              <br />
              MOVE IT은 <b>“링크 하나만 공유하면 회원이 바로 결제·신청”</b>하도록 만들어져 있습니다.
            </p>

            <h3 className="mt-5 text-sm font-bold text-neutral-900 dark:text-white">① 세션(수업) 링크로 특정 수업 홍보</h3>
            <ol className="mt-2 space-y-2.5">
              <Step n={1}>
                <b>스케줄 관리</b>에서 달력의 수업(세션)을 클릭합니다.
              </Step>
              <Step n={2}>
                세션 상세 창 아래의 <b>“결제 링크 복사”</b>를 누릅니다.
              </Step>
              <Step n={3}>
                이 링크를 인스타 스토리·카톡·오픈채팅에 올리면, 누른 회원이 바로 그 수업을 결제·신청합니다.
              </Step>
            </ol>
            <Tip>특정 워크샵·게스트 특강을 띄울 때 가장 강력합니다. “이 수업만” 콕 집어 홍보돼요.</Tip>

            <h3 className="mt-5 text-sm font-bold text-neutral-900 dark:text-white">② 수강권 링크로 이용권 판매</h3>
            <ol className="mt-2 space-y-2.5">
              <Step n={1}>
                <b>수강권/상품</b> 목록에서 홍보할 수강권 옆 <b>링크 아이콘</b>을 누릅니다.
              </Step>
              <Step n={2}>
                “구매 링크가 복사되었습니다” 안내가 뜨면 끝.
              </Step>
              <Step n={3}>
                프로필 링크나 공지에 걸어두면, 회원이 아무 때나 이용권을 구매할 수 있습니다.
              </Step>
            </ol>

            <h3 className="mt-5 text-sm font-bold text-neutral-900 dark:text-white">③ 어디에 올리면 좋을까</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-700 dark:text-neutral-300">
              <li>· 인스타그램 — 프로필 링크, 스토리(링크 스티커), 게시물</li>
              <li>· 카카오톡 — 학원 단톡방, 오픈채팅, 채널 메시지</li>
              <li>· 네이버 — 블로그·카페 글, 플레이스 소식</li>
            </ul>

            <h3 className="mt-5 text-sm font-bold text-neutral-900 dark:text-white">④ 바로 쓰는 홍보 문구</h3>
            <CopyTemplate
              text={`💃 이번 주 신규 클래스 오픈!\n\n📍 [수업명/요일/시간]\n👩‍🏫 강사: [강사명]\n\n아래 링크 누르면 바로 신청·결제돼요 👇\n[여기에 복사한 결제 링크 붙여넣기]\n\n#댄스学원 #취미댄스 #[지역]댄스`}
            />
            <CopyTemplate
              text={`🎫 수강권 할인 이벤트!\n\n[수강권명] — [가격/혜택]\n\n링크에서 바로 구매 가능합니다 👇\n[여기에 복사한 구매 링크 붙여넣기]`}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <GoButton href={`${base}/schedule`}>스케줄에서 세션 링크 복사</GoButton>
              <Link
                href={`${base}/products`}
                className="inline-flex items-center gap-1.5 mt-4 px-3.5 py-2 rounded-lg border border-primary/50 text-primary text-sm font-semibold hover:bg-primary/10 transition-colors"
              >
                수강권 링크 복사
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </section>

          <SectionCard section={SECTIONS[9]}>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">Q. 클래스와 스케줄은 무엇이 다른가요?</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  클래스(반)는 “수업의 종류”이고, 스케줄(세션)은 “실제로 열리는 날짜·시간”입니다.
                  <br />
                  먼저 클래스를 만들고, 그 클래스로 스케줄을 깝니다.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">Q. 회원이 결제하려면 무엇이 있어야 하나요?</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  수강권(상품)이 1개 이상 있어야 합니다.
                  <br />
                  계좌이체를 받으려면 설정에서 입금 계좌도 등록해 주세요.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">Q. 안내 화면을 다시 보고 싶어요.</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  헤더의 <b>“둘러보기”</b> 버튼, 또는 이 페이지 상단의 “화면 따라 둘러보기 시작”을 누르세요.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-white">Q. 문제가 생기거나 기능 요청이 있어요.</p>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  사이드바의 <b>고장신고/개발요청</b>으로 남겨 주시면 확인합니다.
                </p>
              </div>
            </div>
          </SectionCard>

          <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 py-6">
            도움이 더 필요하면 사이드바의 “고장신고/개발요청”으로 문의해 주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
