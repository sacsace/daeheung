import fs from 'fs';
import path from 'path';

const apiDir = path.resolve('src/services/api/domains');
const accounting = fs.readFileSync(path.join(apiDir, 'accounting.ts'), 'utf8');
const users = fs.readFileSync(path.join(apiDir, 'users.ts'), 'utf8');

const typeBlockMatch = accounting.match(/export type UserUiCalendarScheduleItem[\s\S]*?^};\s*$/m);
if (!typeBlockMatch) throw new Error('type block not found in accounting.ts');
const typeBlock = typeBlockMatch[0];

const accountingStripped = accounting.replace(/\n\/\*\* users\.settings\.ui[\s\S]*$/m, '\n');
const usersPatched = users.replace(
  /export const userUiPreferencesService = \{/,
  `${typeBlock}\n\nexport const userUiPreferencesService = {`
);

fs.writeFileSync(path.join(apiDir, 'accounting.ts'), accountingStripped, 'utf8');
fs.writeFileSync(path.join(apiDir, 'users.ts'), usersPatched, 'utf8');
console.log('moved UserUiPreferences types to users.ts');
