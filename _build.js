const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const projectDir = path.join(os.homedir(), 'Desktop', 'MOVEIT');
const outFile = path.join(projectDir, '_build_result.txt');

try {
  const result = execSync('npx next build 2>&1', {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 180000,
    shell: 'cmd.exe',
  });
  fs.writeFileSync(outFile, result, 'utf8');
  process.exit(0);
} catch (e) {
  const out = (e.stdout || '') + '\n--- STDERR ---\n' + (e.stderr || '');
  fs.writeFileSync(outFile, out, 'utf8');
  process.exit(1);
}
