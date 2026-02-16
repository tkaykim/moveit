const {execSync} = require('child_process');
const path = require('path');
const os = require('os');

const cwd = path.join(os.homedir(), 'Desktop', 'MOVEIT');

try {
  execSync('git add -A', {cwd, stdio:'inherit'});
  execSync('git commit -m "fix: switch all API calls to use Authorization header instead of cookies"', {cwd, stdio:'inherit'});
  execSync('git push', {cwd, stdio:'inherit'});
  console.log('Done!');
} catch(e) {
  console.error('Error:', e.message);
}
