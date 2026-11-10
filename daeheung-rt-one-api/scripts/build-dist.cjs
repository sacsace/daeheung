/**
 * Production build for Railway:
 * - dist 정리
 * - TypeScript 파일을 타입체크 없이 빠르게 transpile
 * - src 내 비-TS 정적 파일 복사
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const distDir = path.join(rootDir, 'dist');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function transpileTsFile(srcPath, distPath) {
  const source = fs.readFileSync(srcPath, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      resolveJsonModule: true,
      isolatedModules: true,
      sourceMap: false,
      removeComments: true,
    },
    fileName: srcPath,
  });
  ensureDir(path.dirname(distPath));
  fs.writeFileSync(distPath, result.outputText, 'utf8');
}

function processSourceTree(fromDir, toDir) {
  if (path.basename(fromDir) === '__tests__') {
    return;
  }
  ensureDir(toDir);
  const entries = fs.readdirSync(fromDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(fromDir, entry.name);
    const distPath = path.join(toDir, entry.name);
    if (entry.isDirectory()) {
      processSourceTree(srcPath, distPath);
      continue;
    }
    if (entry.name.endsWith('.d.ts')) {
      continue;
    }
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) {
      continue;
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      const jsPath = distPath.replace(/\.(ts|tsx)$/i, '.js');
      transpileTsFile(srcPath, jsPath);
      continue;
    }
    fs.copyFileSync(srcPath, distPath);
  }
}

console.log('🧹 dist 폴더 정리...');
fs.rmSync(distDir, { recursive: true, force: true });

console.log('🔧 TypeScript transpile + 정적 파일 복사...');
processSourceTree(srcDir, distDir);

const distEntry = path.join(distDir, 'index.js');
if (!fs.existsSync(distEntry)) {
  console.error('❌ dist/index.js 생성 실패. 빌드를 중단합니다.');
  process.exit(1);
}

console.log('✅ dist 빌드 완료:', distEntry);

