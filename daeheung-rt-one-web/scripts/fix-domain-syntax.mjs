import fs from 'fs';
import path from 'path';

const dir = path.resolve('src/services/api/domains');
for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith('.ts')) continue;
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/(\/\/[^\n\r]+?)\s{2,}(\w[\w]*:\s*async)/g, '$1\n  $2');
  content = content.replace(/(\/\/[^\n\r]+?)\s{2,}(\w[\w]*:\s*\()/g, '$1\n  $2');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('fixed', file);
}
