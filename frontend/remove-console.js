const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const regex = /(^|\s)(console\.(log|error|warn)\(.*?\);?)/g;
      content = content.replace(regex, '$1//$2');
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`Cleaned: ${fullPath}`);
    }
  });
}

// Lancer sur le dossier src
walk(path.join(__dirname, 'src'));
console.log('✅ Tous les console.log / console.error ont été commentés.');