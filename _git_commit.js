const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const projectDir = path.join(os.homedir(), 'Desktop', 'MOVEIT');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: projectDir, encoding: 'utf8', shell: 'cmd.exe', stdio: 'pipe' });
  } catch (e) {
    return (e.stdout || '') + '\n' + (e.stderr || '');
  }
}

console.log('=== git add ===');
console.log(run('git add types/notifications.ts lib/notifications/send-notification.ts components/notifications/notification-settings.tsx components/notifications/notification-item.tsx app/admin/push/components/push-send-form.tsx app/api/notifications/preferences/route.ts'));

console.log('=== git commit ===');
const msg = 'feat: enhance notification system - type presets, detailed settings, attendance/video/consultation categories';
console.log(run('git commit -m "' + msg + '"'));

console.log('=== git push ===');
console.log(run('git push'));

console.log('=== git status ===');
console.log(run('git status'));
