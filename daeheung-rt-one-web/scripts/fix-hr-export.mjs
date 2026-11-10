import fs from 'fs';
import path from 'path';

const filePath = path.resolve('src/services/api/domains/hr.ts');
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(
  /exportVacationsToExcel:[\s\S]*?responseType: 'blob'\s*\}\);[\s\S]*?catch \(error\)/,
  `exportVacationsToExcel: async (params?: { user_id?: number; status?: string; vacation_type?: string; start_date?: string; end_date?: string; approved_by?: number }) => {
    try {
      const response = await api.get('/hr/vacations/excel/export', {
        params,
        responseType: 'blob'
      });
      return response;
    } catch (error)`
);
fs.writeFileSync(filePath, content, 'utf8');
console.log('patched exportVacationsToExcel');
