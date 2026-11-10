import fs from 'fs';
import path from 'path';

const filePath = path.resolve('../daeheung-rt-one-api/src/routes/users.ts');
let content = fs.readFileSync(filePath, 'utf8');
if (!content.includes('let userListHrFieldsAvailable')) {
  content = content.replace(
    "import path from 'path';\n\n",
    "import path from 'path';\n\nlet userListHrFieldsAvailable: boolean | null = null;\n\n"
  );
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('inserted flag');
} else {
  console.log('already present');
}
