import fs from 'fs';
import path from 'path';

const apiDir = path.resolve('src/services/api');
const servicesPath = path.join(apiDir, 'services.ts');
const content = fs.readFileSync(servicesPath, 'utf8');

const importLine = "import { api, API_BASE_URL, getAuthTokenFromStorage } from '../client';\n\n";

const serviceGroups = {
  'domains/company.ts': ['companyService'],
  'domains/users.ts': ['userService', 'loginInfoService', 'userUiPreferencesService'],
  'domains/accounting.ts': [
    'accountingService',
    'payrollService',
    'ewayBillService',
  ],
  'domains/hr.ts': [
    'hrService',
    'vacationService',
    'employmentContractService',
    'departmentService',
    'attendanceService',
  ],
  'domains/inventory.ts': ['inventoryService'],
  'domains/partners.ts': ['partnerService'],
  'domains/system.ts': [
    'systemSettingsService',
    'officeLocationService',
    'heresnowIntegrationService',
    'noticeService',
  ],
  'domains/work.ts': [
    'projectService',
    'workBoardService',
    'workStatisticService',
    'approvalService',
    'workReportService',
  ],
  'domains/sales.ts': ['quotationService'],
  'domains/hotel.ts': ['roomBookingService', 'roomTypeService', 'roomTypeRoomService'],
};

const re = /^export const (\w+) = \{/gm;
const chunks = [];
let match;
while ((match = re.exec(content)) !== null) {
  chunks.push({ name: match[1], start: match.index });
}
for (let i = 0; i < chunks.length; i++) {
  const end = i + 1 < chunks.length ? chunks[i + 1].start : content.length;
  chunks[i].body = content.slice(chunks[i].start, end).trimEnd();
}

const chunkMap = Object.fromEntries(chunks.map((c) => [c.name, c.body]));
const domainsDir = path.join(apiDir, 'domains');
fs.mkdirSync(domainsDir, { recursive: true });

const written = [];
for (const [relFile, names] of Object.entries(serviceGroups)) {
  const bodies = names.map((n) => {
    if (!chunkMap[n]) throw new Error(`Missing service: ${n}`);
    return chunkMap[n];
  });
  const filePath = path.join(apiDir, relFile);
  fs.writeFileSync(filePath, `${importLine}${bodies.join('\n\n')}\n`);
  written.push(relFile);
}

const barrel = `${written.map((f) => `export * from './${f.replace(/\.ts$/, '')}';`).join('\n')}\n`;
fs.writeFileSync(path.join(apiDir, 'services.ts'), barrel);

const indexPath = path.join(apiDir, 'index.ts');
const indexContent = fs.readFileSync(indexPath, 'utf8');
if (!indexContent.includes("export * from './services'")) {
  fs.writeFileSync(indexPath, `${indexContent.trimEnd()}\nexport * from './services';\n`);
}

console.log('Split services into', written.length, 'domain files');
