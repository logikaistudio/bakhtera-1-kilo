const fs = require('fs');
const path = require('path');

const fixes = [
  // Fix clone files
  { dir: 'scripts/clones', pattern: /path\.join\(__dirname, "\.\.\/\.\.\/src'/g , replacement: `path.join(__dirname, "../../src"` },
  
  // Fix any double quotes that got messed up
  { dir: 'scripts/fixes', pattern: /path\.join\(__dirname, "\.\.\/\.\.\/src'/g , replacement: `path.join(__dirname, "../../src"` },
  { dir: 'scripts/checks', pattern: /path\.join\(__dirname, "\.\.\/\.\.\/\.env'/g , replacement: `path.join(__dirname, "../../.env"` },
];

fixes.forEach(({dir, pattern, replacement}) => {
  if (!fs.existsSync(dir)) {
    console.log(`Directory not found: ${dir}`);
    return;
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.cjs') || f.endsWith('.js'));
  files.forEach(file => {
    const filepath = path.join(dir, file);
    let content = fs.readFileSync(filepath, 'utf8');
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      fs.writeFileSync(filepath, content);
      console.log(`Fixed: ${filepath}`);
    }
  });
});
