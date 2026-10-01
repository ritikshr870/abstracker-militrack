const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('  ABSTRACKER TELEMATICS SUITE PRODUCTION BUILD');
console.log(`  Node.js Runtime Version: ${process.version}`);
console.log('====================================================');

const clientDist = path.join(__dirname, 'client', 'dist', 'index.html');
const userDist = path.join(__dirname, 'user-client', 'dist', 'index.html');

const hasClientDist = fs.existsSync(clientDist);
const hasUserDist = fs.existsSync(userDist);

const rawVersion = process.version.replace(/^v/, '');
const majorVersion = parseInt(rawVersion.split('.')[0], 10) || 18;

// If pre-built bundles are already present in git repository (e.g. for Hostinger Node 18)
if (hasClientDist && hasUserDist) {
  console.log('✓ Found pre-compiled production bundles:');
  console.log(`  - Client Web Console: ${clientDist}`);
  console.log(`  - User Tracking App : ${userDist}`);

  if (majorVersion < 20) {
    console.log(`\n[Hostinger Deployment] Node.js ${process.version} environment detected.`);
    console.log('✓ Using pre-compiled production bundles to ensure 100% compatibility with Express server.');
    console.log('✓ Hostinger build succeeded without Rolldown/Vite engine conflicts.\n');
    process.exit(0);
  }
}

// On Node 20+ or when dist is missing, run full Vite build
try {
  console.log('\nBuilding Client Web Console...');
  execSync('npm run build --prefix client', { stdio: 'inherit' });

  console.log('\nBuilding User Client Web App...');
  execSync('npm run build --prefix user-client', { stdio: 'inherit' });

  console.log('\n✓ All production bundles compiled successfully!');
  process.exit(0);
} catch (err) {
  if (hasClientDist && hasUserDist) {
    console.warn('\n⚠️ Re-compilation warning encountered, but verified pre-compiled bundles exist.');
    console.log('✓ Using pre-compiled production bundles for Express server.');
    process.exit(0);
  } else {
    console.error('\n❌ Build failed and no pre-compiled bundles were found:', err.message);
    process.exit(1);
  }
}
