import fs from 'fs';
import path from 'path';

const root = path.resolve('src/services');
const src = fs.readFileSync(path.join(root, 'api.ts'), 'utf8');
const marker = '// 회사 정보 API 서비스';
const idx = src.indexOf(marker);
if (idx < 0) throw new Error('marker not found');

const client = `${src.slice(0, idx).trimEnd()}\n\nexport { api };\n`;
const services = `import { api } from './client';\n\n${src.slice(idx).replace(/\nexport \{ api \};\s*$/m, '').trimEnd()}\n`;

const dir = path.join(root, 'api');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'client.ts'), client);
fs.writeFileSync(path.join(dir, 'services.ts'), services);
fs.writeFileSync(
  path.join(dir, 'index.ts'),
  "export * from './client';\nexport * from './services';\nexport { api } from './client';\n"
);
fs.writeFileSync(
  path.join(root, 'api.ts'),
  "export * from './api/index';\nexport { api } from './api/client';\n"
);
console.log('Done', { clientLines: client.split('\n').length, servicesLines: services.split('\n').length });
