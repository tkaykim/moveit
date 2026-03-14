/**
 * scripts/march-2026-values.txt 내용을 읽어 INSERT 쿼리 2개로 나눠 출력.
 * Supabase execute_sql 또는 SQL Editor에서 1번, 2번 순서대로 실행.
 */
const fs = require('fs');
const path = require('path');

const valuesPath = path.join(__dirname, 'march-2026-values.txt');
const lines = fs.readFileSync(valuesPath, 'utf8').split('\n').filter(Boolean);
// 첫 줄 주석 제외
const valueLines = lines[0].startsWith('--') ? lines.slice(1) : lines;
const BATCH = 75;
const batch1 = valueLines.slice(0, BATCH);
const batch2 = valueLines.slice(BATCH);

function toSql(batch) {
  const last = batch.length - 1;
  const values = batch.map((line, i) => (i < last ? line.trimEnd() : line.trimEnd().replace(/,$/, ''))).join('\n');
  return `INSERT INTO schedules (class_id, start_time, end_time, hall_id) VALUES\n${values};`;
}

console.log('-- ========== 1번 쿼리 (75행) ==========');
console.log(toSql(batch1));
console.log('\n-- ========== 2번 쿼리 (76행) ==========');
console.log(toSql(batch2));
