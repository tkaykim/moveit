const fs = require('fs');
const path = require('path');

const cacheDirs = [
  path.join(process.cwd(), '.next', 'cache'),
  path.join(process.cwd(), '.next', 'cache', 'webpack'),
];

console.log('캐시 정리 중...');

cacheDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`✓ ${dir} 삭제 완료`);
    } catch (error) {
      console.error(`✗ ${dir} 삭제 실패:`, error.message);
    }
  }
});

console.log('캐시 정리 완료!');



