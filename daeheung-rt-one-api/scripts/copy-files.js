const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const items = fs.readdirSync(src);
  
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// dist 폴더를 삭제하고 다시 생성
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  fs.rmSync(distPath, { recursive: true, force: true });
}

// src 폴더를 dist로 복사
const srcPath = path.join(__dirname, '..', 'src');
copyDir(srcPath, distPath);

// .ts 파일을 .js로 이름 변경
function renameTsToJs(dir) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const itemPath = path.join(dir, item);
    
    if (fs.statSync(itemPath).isDirectory()) {
      renameTsToJs(itemPath);
    } else if (item.endsWith('.ts')) {
      const newPath = itemPath.replace('.ts', '.js');
      fs.renameSync(itemPath, newPath);
      
      // 파일 내용에서 TypeScript 타입 정의 제거
      let content = fs.readFileSync(newPath, 'utf8');
      
      // 간단한 TypeScript 제거
      content = content
        .replace(/import.*?from\s+['"](sequelize|express|bcrypt|socket\.io|winston|cors|helmet|express-rate-limit)['"]\s*;?/g, '')
        .replace(/:.*?\||\|\s*$|&|interface\s+\w+.*?{|type\s+\w+.*?=/g, '')
        .replace(/\((.*?)\s+as\s+any\)/g, '$1')
        .replace(/:\s*any/g, '')
        .replace(/\?\s*:\s*\w+/g, '')
        .replace(/const\s+(\w+):\s*\w+\s*=/g, 'const $1 = ');

      fs.writeFileSync(newPath, content);
    }
  }
}

renameTsToJs(distPath);
console.log('✅ Files copied and renamed successfully');
