/**
 * 디프런프롬세임 2026년 3월 스케줄 INSERT 값 생성
 * hall_id: 693426c1-1b3e-4c9b-9f68-a2c182733bb1
 * KST=UTC+9 → 17:00 KST = 08:00 UTC, 18:00=09:00, 19:20=10:20, 20:40=11:40, 22:00=13:00
 * 토요일: 14:00 KST=05:00 UTC, 15:30=06:30, 17:00=08:00, 18:20=09:20
 */
const HALL = '693426c1-1b3e-4c9b-9f68-a2c182733bb1';
const classIds = {
  'ZIMO': '41b2ef35-f95b-4f8d-aee2-3ac1ccec5383',
  'HWAGA': '1158d2e6-8a70-4618-97e3-812149fcf518',
  'SEEUN': 'cf3d8b8f-1f88-4b50-834e-d39ebf9fbacc',
  'BISU': '7333b066-8185-4de9-b127-8f06ef4ade8a',
  'GUNMIN': '0d66028b-d3ee-44a4-b341-ebc8fa9fc7c8',
  'DANIEL': 'b721ed6c-d775-40d2-9e77-f5858b9f750a',
  'NE:A키즈기초': 'ce8ff873-e794-444a-918c-5a7151b3d35c',
  'MELMAN': '108c1e87-14cc-401a-87d1-032f81a86415',
  'S.JIN': 'd7b1ff1e-0cea-4f03-b772-7c1baae5ff3d',
  'LIJUN': 'b623f491-6375-4178-b4b5-32d26d128685',
  '오디션반': '95654720-d9c2-4e7e-8f07-45bc8b787e66',
  '전문반': '9039ebda-3d36-40ee-a1fc-8b7b48cbeafe',
  '키즈크루': '4693037f-1a71-4938-8d7b-0aea1dd86fef',
  'RUDE.V': '303a7716-d4f1-48b2-944c-732af30ee7d7',
  'HWANA': '58432952-4ee0-4a24-8c2d-13909f1d7cc8',
  'HYUNSEO': '3f05a07e-99d5-4388-b82d-773b8fae76dd',
  'COXY': 'f040dd40-ba84-4143-95b5-9f4b9571825c',
  'NE:A키즈K-POP': 'f85ff764-6504-4ad9-8a39-4b663869b3e7',
  'ZIYU입시반': 'd8d301d4-636b-47b6-97e2-9149a1485781',
  'JOO': 'f3a7d343-3ef6-4fc1-a419-8cb7012b8c65',
  'MINJUNG': 'b442d869-aab8-4684-9073-6b9ba133fd3a',
  'KAT': 'fde218b7-1c9e-4f46-a5e9-6daa15f9a7b4',
  'BIYA': '09f0f44c-6bd0-4510-899d-d4b48036e130',
  'SEUNGCHEOL': 'd463e539-8168-4cb5-9b2a-f652f3e97746',
  'HEYSON': 'de77340c-aa82-4517-a685-533455048fed',
  'ZERRY': '65b3426f-1d17-4c6f-9723-41a601b13bc7',
  'IAN': 'c49419e3-9aae-4c52-a668-a113463f00e8',
  'HAZZI': 'fb25d379-4fde-49da-97c5-1ef896f8500f',
  'SONGYI': '7ba10ffe-0a01-47ab-82cf-187cdc7b767a',
  'ALVIN': '45be2222-3f7a-4a2c-a556-958d8c059970',
  '왕기초반': '52ea0f3e-3b43-454e-8ea8-4b5ca6165a59',
  '기초하드': '41d24d65-3016-4bb6-bac2-80ca5c7cf873',
  '예비오디션반': 'b410597d-e9d1-409b-b49a-dc4a31045d40',
  '걸스힙합': '965d0a5b-ee1b-4717-88cb-9da802c4f1a1',
  '걸리쉬': 'a31856e7-f4b3-4f5f-83fb-bc76ee7825ff',
};

function row(classKey, date, startUTC, endUTC) {
  const cid = classIds[classKey];
  const sid = `'${date} ${startUTC}+00'`;
  const eid = `'${date} ${endUTC}+00'`;
  return `('${cid}', ${sid}, ${eid}, '${HALL}')`;
}

const rows = [];
const pad = (n) => String(n).padStart(2, '0');

// 월요일 2,9,16,23,30 — A 08:00-09:00: ZIMO,HWAGA (23: HWAGA만) / C 10:20-11:40: SEEUN,BISU / D 11:40-13:00: GUNMIN,DANIEL
[2, 9, 16, 23, 30].forEach((d) => {
  const date = `2026-03-${pad(d)}`;
  if (d !== 23) rows.push(row('ZIMO', date, '08:00:00', '09:00:00'));
  rows.push(row('HWAGA', date, '08:00:00', '09:00:00'));
  rows.push(row('SEEUN', date, '10:20:00', '11:40:00'));
  rows.push(row('BISU', date, '10:20:00', '11:40:00'));
  rows.push(row('GUNMIN', date, '11:40:00', '13:00:00'));
  rows.push(row('DANIEL', date, '11:40:00', '13:00:00'));
});

// 화요일 3,10,17,24,31 — A 08:00-09:00 NE:A키즈기초 / B 09:00-10:20 MELMAN / C 10:20-11:40 S.JIN,LIJUN / D 11:40-13:00 오디션반,전문반
[3, 10, 17, 24, 31].forEach((d) => {
  const date = `2026-03-${pad(d)}`;
  rows.push(row('NE:A키즈기초', date, '08:00:00', '09:00:00'));
  rows.push(row('MELMAN', date, '09:00:00', '10:20:00'));
  rows.push(row('S.JIN', date, '10:20:00', '11:40:00'));
  rows.push(row('LIJUN', date, '10:20:00', '11:40:00'));
  rows.push(row('오디션반', date, '11:40:00', '13:00:00'));
  rows.push(row('전문반', date, '11:40:00', '13:00:00'));
});

// 31일 특별: 05:00-06:20 전문반, 06:30-07:50 입시반, 08:00-09:20 걸리쉬, 09:20-10:40 오디션/왕기초/걸스힙합 (이미 위에서 31일 08:00 NE:A, 09:00 MELMAN 등 넣음 — 31일은 화요일이므로 평일 슬롯 대신 특별 스케줄로 덮어쓸지? 이미지상 31일은 특별 타임만 있음. 기존 31일 화요일 정규도 있음. 둘 다 넣으면 됨.)
// 31일 특별 세션 추가
rows.push(row('전문반', '2026-03-31', '05:00:00', '06:20:00'));
rows.push(row('ZIYU입시반', '2026-03-31', '06:30:00', '07:50:00'));
rows.push(row('걸리쉬', '2026-03-31', '08:00:00', '09:20:00'));
rows.push(row('오디션반', '2026-03-31', '09:20:00', '10:40:00'));
rows.push(row('왕기초반', '2026-03-31', '09:20:00', '10:40:00'));
rows.push(row('걸스힙합', '2026-03-31', '09:20:00', '10:40:00'));

// 수요일 4,11,18,25 — B 09:00-10:20 키즈크루(4,11,25) / C: 4,11 RUDE.V,HWANA; 18 HWANA; 25 WOOTAE,HWANA / D: HYUNSEO(전부), COXY(18,25)
[4, 11].forEach((d) => {
  const date = `2026-03-${pad(d)}`;
  rows.push(row('키즈크루', date, '09:00:00', '10:20:00'));
  rows.push(row('RUDE.V', date, '10:20:00', '11:40:00'));
  rows.push(row('HWANA', date, '10:20:00', '11:40:00'));
  rows.push(row('HYUNSEO', date, '11:40:00', '13:00:00'));
});
rows.push(row('HWANA', '2026-03-18', '10:20:00', '11:40:00'));
rows.push(row('HYUNSEO', '2026-03-18', '11:40:00', '13:00:00'));
rows.push(row('COXY', '2026-03-18', '11:40:00', '13:00:00'));
[25].forEach((d) => {
  const date = `2026-03-${pad(d)}`;
  rows.push(row('키즈크루', date, '09:00:00', '10:20:00'));
  rows.push(row('기초하드', date, '10:20:00', '11:40:00')); // WOOTAE 기초하드
  rows.push(row('HWANA', date, '10:20:00', '11:40:00'));
  rows.push(row('HYUNSEO', date, '11:40:00', '13:00:00'));
  rows.push(row('COXY', date, '11:40:00', '13:00:00'));
});
// 25일 WOOTAE|HWANA → 기초하드트레이닝 + HWANA Tutting

// 목요일 5,12,19,26 — A 08:00-09:00 NE:A 키즈 K-POP / B: 5 입시반; 12,19,26 JOO+입시반 / C: 5,19 MINJUNG,KAT; 12,26 MINJUNG / D: 5 BIYA,COXY; 12,26 SEUNGCHEOL; 19 BIYA
[5].forEach((d) => {
  const date = `2026-03-${pad(d)}`;
  rows.push(row('NE:A키즈K-POP', date, '08:00:00', '09:00:00'));
  rows.push(row('ZIYU입시반', date, '09:00:00', '10:20:00'));
  rows.push(row('MINJUNG', date, '10:20:00', '11:40:00'));
  rows.push(row('KAT', date, '10:20:00', '11:40:00'));
  rows.push(row('BIYA', date, '11:40:00', '13:00:00'));
  rows.push(row('COXY', date, '11:40:00', '13:00:00'));
});
[12, 19, 26].forEach((d) => {
  const date = `2026-03-${pad(d)}`;
  rows.push(row('NE:A키즈K-POP', date, '08:00:00', '09:00:00'));
  rows.push(row('JOO', date, '09:00:00', '10:20:00'));
  rows.push(row('ZIYU입시반', date, '09:00:00', '10:20:00'));
  rows.push(row('MINJUNG', date, '10:20:00', '11:40:00'));
  if (d === 19) rows.push(row('KAT', date, '10:20:00', '11:40:00'));
  if (d === 12 || d === 26) rows.push(row('BIYA', date, '10:20:00', '11:40:00')); // 12,26 MINJUNG|BIYA
  if (d === 19) rows.push(row('BIYA', date, '11:40:00', '13:00:00'));
  if (d === 12 || d === 26) rows.push(row('SEUNGCHEOL', date, '11:40:00', '13:00:00'));
});

// 금요일 6,13,20,27 — A HEYSON,ZERRY / C IAN,HAZZI / D SONGYI,ALVIN
[6, 13, 20, 27].forEach((d) => {
  const date = `2026-03-${pad(d)}`;
  rows.push(row('HEYSON', date, '08:00:00', '09:00:00'));
  rows.push(row('ZERRY', date, '08:00:00', '09:00:00'));
  rows.push(row('IAN', date, '10:20:00', '11:40:00'));
  rows.push(row('HAZZI', date, '10:20:00', '11:40:00'));
  rows.push(row('SONGYI', date, '11:40:00', '13:00:00'));
  rows.push(row('ALVIN', date, '11:40:00', '13:00:00'));
});

// 토요일 7,14,21,28 — 05:00-06:20 왕기초(전부), 기초하드(7,28) / 06:30-07:50 예비오디션 / 08:00-09:20 걸스힙합,오디션 / 09:20-10:40 걸리쉬
[7, 14, 21, 28].forEach((d) => {
  const date = `2026-03-${pad(d)}`;
  rows.push(row('왕기초반', date, '05:00:00', '06:20:00'));
  if (d === 7 || d === 28) rows.push(row('기초하드', date, '05:00:00', '06:20:00'));
  rows.push(row('예비오디션반', date, '06:30:00', '07:50:00'));
  rows.push(row('걸스힙합', date, '08:00:00', '09:20:00'));
  rows.push(row('오디션반', date, '08:00:00', '09:20:00'));
  rows.push(row('걸리쉬', date, '09:20:00', '10:40:00'));
});

// 31일 화요일 정규와 중복되는 특별 세션: 정규는 이미 넣었고, 특별(05:00 전문반 등)만 추가했음. 31일 정규 08:00 NE:A, 09:00 MELMAN 등은 그대로 두고, 추가로 05:00-06:20 전문반 등 6개만 넣은 것. OK.

console.log('-- Schedule rows: ' + rows.length);
console.log(rows.join(',\n'));
