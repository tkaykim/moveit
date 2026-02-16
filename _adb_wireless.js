const { execSync, spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

const home = os.homedir();
const adb = path.join(home, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe');

// 페어링: 폰 '무선 디버깅' → '페어링 코드로 기기 페어링'에 나온 포트 사용
const pairPort = '33621';
const pairingCode = '254542';
const pairHost = '172.30.1.57:' + pairPort;

console.log('1) ADB 페어링:', pairHost, '코드:', pairingCode);
const pairResult = spawnSync(adb, ['pair', pairHost, pairingCode], {
  encoding: 'utf8',
  timeout: 15000,
});
console.log(pairResult.stdout || '');
if (pairResult.stderr) console.log(pairResult.stderr);
if (pairResult.status !== 0 && !String(pairResult.stdout || '').includes('Successfully paired')) {
  console.log('페어링 실패 시 39685 포트로 재시도...');
  const pair2 = spawnSync(adb, ['pair', '172.30.1.57:39685', pairingCode], {
    encoding: 'utf8',
    timeout: 15000,
  });
  console.log(pair2.stdout || '');
}

// 연결: 폰 'IP 주소 및 포트'에 나온 포트 (33621 또는 39685)
const connectPorts = ['33621', '39685'];
for (const port of connectPorts) {
  console.log('\n2) ADB 연결 172.30.1.57:' + port + '...');
  const connectResult = spawnSync(adb, ['connect', '172.30.1.57:' + port], {
    encoding: 'utf8',
    timeout: 10000,
  });
  console.log(connectResult.stdout || '');
  if (String(connectResult.stdout || '').includes('connected')) break;
}

console.log('\n3) 연결된 기기 목록');
try {
  const devices = execSync(`"${adb}" devices`, { encoding: 'utf8', timeout: 5000 });
  console.log(devices);
} catch (e) {
  console.error(e.message);
}
