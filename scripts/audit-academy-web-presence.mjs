import { writeFile } from 'node:fs/promises';

const academies = [
  { id: '4be89059-451d-4628-870f-143fc3b31593', name: '라인업댄스학원', nameEn: 'LiNE UP Dance Studio', address: '효행로 1059 7층 707호' },
  { id: '940d549f-c99f-4cd6-8a0f-8e12475ed55b', name: 'DXNCE 댄스 스튜디오', nameEn: 'DXNCE Dance studio', address: '사당' },
  { id: 'feb01805-32fc-4c55-84a6-dd89c0f39180', name: '니르바 댄스학원', nameEn: 'NIRVA DANCE STUDIO', address: '고양시 덕양구 화정동 화신로 260번길 64 5F' },
  { id: 'dc87f10c-fe78-4c71-b158-b5b963ac7e58', name: '아임뉴댄스 하남미사점', nameEn: 'IMNEW HANAM MISA', address: '경기도 하남시 미사강변동로 84번길 21, 남송타워 5층' },
  { id: '462980c8-ba5e-4b06-9d47-c9786d44b7d4', name: '디프런프롬세임', nameEn: 'DifferentFromSame', address: '서울특별시 성동구 광나루로 210 보은빌딩 2F' },
  { id: '67386a53-305b-4650-87cc-959426f61c96', name: 'GB 댄스 아카데미', nameEn: 'GB Dance Academy', address: '대전광역시 중구 중앙로164번길 26' },
  { id: '9015124e-9056-4d85-84b2-dcdd218fa57e', name: 'IB 실용 음악 댄스', nameEn: 'IB Music & Dance', address: '경기도 용인시 처인구 중부대로 1331' },
  { id: '12c1ee33-c205-4ee4-9f84-ced4856f9e92', name: 'LJ 댄스 스쿨', nameEn: 'LJ Dance School', address: '경기도 성남시 분당구 황새울로360번길 21' },
  { id: '499d1ff8-b147-4d43-ab35-a4631cc87c57', name: 'OFD 댄스 스튜디오', nameEn: 'OFD Dance Studio', address: '서울특별시 마포구 잔다리로 28' },
  { id: '10e1d95e-dd55-4545-a867-41c51320d40d', name: '나타라자 아카데미', nameEn: 'Nataraja Academy', address: '부산광역시 중구 광복중앙로 22' },
  { id: '6ac989ff-a25e-4dd9-a7ca-4bc2bc01e262', name: '대전 댄스 보컬 학원', nameEn: 'Daejeon Dance Vocal', address: '대전광역시 서구 둔산로 34' },
  { id: '8661141e-5800-43e5-aa85-cd0394d623d7', name: '데프 댄스 스쿨', nameEn: 'DEF Dance Skool', address: '서울특별시 강남구 영동대로85길 25' },
  { id: '05e26323-f383-4cf3-b91e-8e89062f5bb7', name: '리듬하츠 댄스 아카데미', nameEn: 'Rhythm Heartz', address: '인천광역시 부평구 시장로 21' },
  { id: 'da9df206-53f6-4cad-9862-7b8973256725', name: '모웰 댄스 아카데미', nameEn: 'Mowell Dance Academy', address: '광주광역시 북구 설죽로 309' },
  { id: '8612a54e-6050-4de9-be6f-83d322c7ddcf', name: '무브 댄스 (수원점)', nameEn: 'Move Dance Suwon', address: '경기도 수원시 팔달구 향교로 47' },
  { id: '0b8b4c9c-aca3-436a-98ff-e47b5f052231', name: '무브 댄스 스튜디오', nameEn: 'Move Dance Studio', address: '서울특별시 마포구 양화로 183' },
  { id: 'd92c2f13-e664-4742-8277-f81a9d92ca67', name: '브랜뉴 댄스 아카데미', nameEn: 'Brand New Dance Academy', address: '부산광역시 부산진구 중앙대로 686' },
  { id: '8d383bd5-24c6-4d62-b347-656b20299ddf', name: '비트믹스 댄스 스튜디오', nameEn: 'Beat Mix Dance Studio', address: '경기도 부천시 원미구 상동로 87' },
  { id: '4df0f2d5-3ef6-440b-ba16-05b154f4085e', name: '스텝업 댄스 아카데미', nameEn: 'Step Up Dance Academy', address: '경기도 용인시 기흥구 죽전로 7' },
  { id: '148b9c23-f414-4495-8a8c-9ce368be5467', name: '썸 댄스 스튜디오', nameEn: 'Sum Dance Studio', address: '울산광역시 남구 삼산로 273' },
  { id: '5df2050c-bdae-4013-9b9d-e5679e65aa57', name: '아트원 댄스 스튜디오', nameEn: 'Art One Dance Studio', address: '대구광역시 달서구 달구벌대로 1530' },
  { id: 'ea0cfd53-b161-41a0-9f36-1f50b819df46', name: '알파 실용 음악 댄스', nameEn: 'Alpha Music & Dance', address: '경기도 고양시 일산동구 중앙로1275번길 38-10' },
  { id: '996965c2-11af-4773-8cf4-d4862ef4365e', name: '얼라이브 댄스 스튜디오', nameEn: 'Alive Dance Studio', address: '서울특별시 강남구 선릉로157길 22' },
  { id: 'cd43dae6-d6a7-491c-81be-3ab323c07858', name: '에이크러쉬 댄스', nameEn: 'A-Crush Dance', address: '경기도 고양시 일산서구 중앙로 1437' },
  { id: '9e71ce1a-f14a-4445-852e-049fbc7b49a7', name: '원밀리언 댄스 스튜디오', nameEn: '1MILLION Dance Studio', address: '서울특별시 성동구 뚝섬로13길 33' },
  { id: '18c9d569-cb35-4da9-8d74-5cb71880cdb7', name: '원비트 댄스 스튜디오', nameEn: 'One Beat Dance Studio', address: '경기도 안양시 동안구 평촌대로223번길 49' },
  { id: '0ab8b5d8-6e9e-4d80-b9b2-f4f6d83b4675', name: '위드빌 댄스 (서현점)', nameEn: 'Withbill Dance Seongnam', address: '경기도 성남시 분당구 서현로 210' },
  { id: 'b2c9eace-5ca2-4078-97c7-25d7640f5efa', name: '위드빌 댄스 스튜디오', nameEn: 'Withbill Dance Studio', address: '서울특별시 강남구 테헤란로 115' },
  { id: '2f41a246-1bd6-4b14-995e-89808ab7739a', name: '저스트저크 아카데미', nameEn: 'Just Jerk Academy', address: '서울특별시 마포구 신촌로2길 19' },
  { id: 'ce5ca5ce-645b-4419-8d93-74e78dcd336a', name: '제이 댄스 스튜디오', nameEn: 'J Dance Studio', address: '울산광역시 남구 번영로 165' },
  { id: '02c0c9e9-ea19-4422-b0df-5b58ec7b8894', name: '제이월드 댄스', nameEn: 'J-World Dance', address: '경기도 부천시 원미구 부천로9번길 28' },
  { id: 'fac56488-730e-4da3-be7f-bc5583fde2d0', name: '조이 댄스 플러그인 뮤직', nameEn: 'Joy Dance Plugin (Incheon)', address: '인천광역시 부평구 부평문화로 45' },
  { id: '3f1ef5d3-cdb0-4027-941c-d719409f4eb7', name: '조이 댄스 플러그인 뮤직 (본점)', nameEn: 'Joy Dance Plugin (Gwangju)', address: '광주광역시 동구 중앙로160번길 13' },
  { id: '5e99b57c-5ec4-4a9c-8cf6-f87f60fad0d0', name: '투브이 댄스 스튜디오', nameEn: '2V Dance Studio', address: '경기도 수원시 팔달구 덕영대로 905' },
  { id: '64e5f5ed-a6c8-4d1b-923b-317b41808838', name: '파이브 뮤직 앤 댄스', nameEn: 'Five Music & Dance', address: '대구광역시 중구 동성로3길 102' },
  { id: '299a8d76-f753-4e0f-9c53-e65786ca2be9', name: '포에이치 댄스', nameEn: '4H Dance Studio', address: '경기도 안양시 만안구 안양로 268' },
  { id: 'a981e833-a0e6-4e4c-a1c3-6b585f6d9aa6', name: '프리픽스 스튜디오', nameEn: 'Prepix Studio', address: '서울특별시 강남구 논현로175길 38' },
  { id: 'e26e5aef-1337-4007-bc7d-95f00a9901b6', name: '피드백 스튜디오', nameEn: 'Feedback Studio', address: '서울특별시 송파구 백제고분로45길 19' },
  { id: 'b56add7d-f5b3-4d3b-bb6a-dc768b87227a', name: '테스트 아카데미', nameEn: 'test dance', address: '' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function compact(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function parseLinks(html) {
  const links = [];
  const linkRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = linkRe.exec(html))) {
    const url = decodeHtml(match[1]);
    const text = stripTags(match[2]);
    if (!url || url.startsWith('#') || url.startsWith('?')) continue;
    if (url.includes('search.shopping.naver.com') || url.includes('dict.naver.com')) continue;
    if (url.includes('help.naver.com') || url.includes('nid.naver.com')) continue;
    if (!text && !url.includes('instagram') && !url.includes('blog.naver')) continue;
    links.push({ text, url });
  }
  return links;
}

function relevance(academy, link, queryKind) {
  const haystack = compact(`${link.text} ${link.url}`);
  const name = compact(academy.name);
  const nameNoSuffix = compact(academy.name.replace(/댄스|스튜디오|학원|아카데미|스쿨|보컬|실용|음악/g, ''));
  const addressTokens = compact(academy.address)
    .split(/[,()]/)
    .filter((part) => part.length >= 4);
  let score = 0;
  if (name && haystack.includes(name)) score += 8;
  if (nameNoSuffix.length >= 3 && haystack.includes(nameNoSuffix)) score += 4;
  if (academy.nameEn && haystack.includes(compact(academy.nameEn))) score += 5;
  for (const token of addressTokens) {
    if (haystack.includes(token)) score += 3;
  }
  if (/폐업|폐원|직권말소|휴업|영업종료|폐쇄/.test(link.text)) score += 10;
  if (/교육지원청|공고|공공데이터|학원및교습소|위세브|강남엄마|런즈|인스타그램|instagram|blog\.naver|map\.naver|place\.naver/i.test(`${link.text} ${link.url}`)) score += 2;
  if (queryKind === 'closure' && score > 0) score += 1;
  return score;
}

async function searchNaver(query) {
  const url = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
      'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.6,en;q=0.5',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return parseLinks(await response.text());
}

const audit = [];
for (const academy of academies) {
  const queries = [
    { kind: 'exact', query: academy.address ? `${academy.name} ${academy.address}` : academy.name },
    { kind: 'closure', query: `${academy.name} 폐업 직권말소 휴업 폐원` },
    { kind: 'social', query: `${academy.name} 인스타그램 네이버지도` },
  ];

  const evidence = [];
  for (const item of queries) {
    let links = [];
    try {
      links = await searchNaver(item.query);
    } catch (error) {
      evidence.push({ kind: item.kind, query: item.query, error: error.message, links: [] });
      await sleep(1000);
      continue;
    }
    const ranked = links
      .map((link) => ({ ...link, score: relevance(academy, link, item.kind) }))
      .filter((link) => link.score >= 5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    evidence.push({ kind: item.kind, query: item.query, links: ranked });
    await sleep(550);
  }

  const allLinks = evidence.flatMap((item) => item.links || []);
  const closureHit = allLinks.some((link) => /폐업|폐원|직권말소|휴업|영업종료|폐쇄/.test(link.text));
  const officialHit = allLinks.some((link) => /교육지원청|공고|공공데이터|학원및교습소|위세브/i.test(`${link.text} ${link.url}`));
  const hasAnyHit = allLinks.length > 0;
  let status = 'needs_manual_review';
  if (academy.name.includes('테스트') || compact(academy.nameEn).includes('test')) status = 'internal_test_hide';
  else if (closureHit && officialHit) status = 'likely_closed_hide';
  else if (!hasAnyHit) status = 'no_web_presence_review';
  else status = 'web_presence_found';

  const row = { academy, status, evidence };
  audit.push(row);
  console.log(`${academy.name} => ${status} (${allLinks.length} evidence links)`);
}

await writeFile('docs/academy-web-audit-2026-06-20.json', JSON.stringify(audit, null, 2), 'utf8');

const summary = audit.map((row) => {
  const top = row.evidence.flatMap((item) => item.links || []).slice(0, 3);
  return [
    `## ${row.academy.name}`,
    `- id: ${row.academy.id}`,
    `- status: ${row.status}`,
    `- address: ${row.academy.address || '(none)'}`,
    ...top.map((link) => `- evidence: ${link.text} (${link.url})`),
    '',
  ].join('\n');
}).join('\n');
await writeFile('docs/academy-web-audit-2026-06-20.md', summary, 'utf8');
