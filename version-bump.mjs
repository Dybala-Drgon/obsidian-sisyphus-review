const fs = require('fs');
const process = require('process');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const newVersion = process.argv[2];

if (!newVersion) {
  console.error('请提供新版本号');
  process.exit(1);
}

// 更新 manifest.json
manifest.version = newVersion;
fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));

// 更新 package.json
packageJson.version = newVersion;
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

console.log(`版本已更新至 ${newVersion}`);
