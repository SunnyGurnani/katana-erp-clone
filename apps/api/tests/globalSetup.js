const { execSync } = require('child_process');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.test'), override: true });

module.exports = async function globalSetup() {
  const root = path.join(__dirname, '..');
  execSync('npx prisma migrate deploy', { cwd: root, stdio: 'inherit', env: process.env });
  execSync('npx prisma generate', { cwd: root, stdio: 'inherit', env: process.env });
};
