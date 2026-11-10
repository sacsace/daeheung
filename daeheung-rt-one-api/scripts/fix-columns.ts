import { connectDB } from '../src/models';
import sequelize from '../src/config/database';

async function fixDatabaseColumns() {
  try {
    console.log('🚀 Fixing database columns...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    // Fix companies table
    console.log('🔧 Fixing companies table...');
    const [companyColumns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'companies'
    `);
    
    const existingCompanyColumns = (companyColumns as any[]).map((r: any) => r.column_name);
    console.log('Existing company columns:', existingCompanyColumns);
    
    const companyColumnsToAdd = [
      { name: 'website', type: 'VARCHAR(255)' },
      { name: 'industry', type: 'VARCHAR(100)' },
      { name: 'employee_count', type: 'INTEGER DEFAULT 0' },
      { name: 'subscription_plan', type: "VARCHAR(50) DEFAULT 'basic'" },
      { name: 'subscription_status', type: "VARCHAR(20) DEFAULT 'active'" },
      { name: 'account_holder_name', type: 'VARCHAR(255)' },
      { name: 'bank_name', type: 'VARCHAR(100)' },
      { name: 'account_number', type: 'VARCHAR(50)' },
      { name: 'ifsc_code', type: 'VARCHAR(11)' },
      { name: 'login_period_start', type: 'DATE' },
      { name: 'login_period_end', type: 'DATE' },
      { name: 'login_time_start', type: "TIME DEFAULT '09:00:00'" },
      { name: 'login_time_end', type: "TIME DEFAULT '18:00:00'" },
      { name: 'timezone', type: "VARCHAR(50) DEFAULT 'Asia/Seoul'" },
      { name: 'settings', type: "JSONB DEFAULT '{}'" }
    ];
    
    for (const col of companyColumnsToAdd) {
      if (!existingCompanyColumns.includes(col.name)) {
        console.log(`  Adding column: ${col.name}...`);
        await sequelize.query(`ALTER TABLE companies ADD COLUMN ${col.name} ${col.type}`);
      }
    }
    
    // Fix menus table
    console.log('🔧 Fixing menus table...');
    const [menuColumns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'menus'
    `);
    
    const existingMenuColumns = (menuColumns as any[]).map((r: any) => r.column_name);
    console.log('Existing menu columns:', existingMenuColumns);
    
    // Rename columns if needed (with proper error handling)
    if (existingMenuColumns.includes('name') && !existingMenuColumns.includes('name_ko')) {
      try {
        console.log('  Renaming name to name_ko...');
        await sequelize.query('ALTER TABLE menus RENAME COLUMN name TO name_ko');
        console.log('  ✅ Renamed name to name_ko');
      } catch (error: any) {
        if (!error.message.includes('does not exist')) {
          console.error('  ⚠️  Error renaming name column:', error.message);
        }
      }
    }
    if (existingMenuColumns.includes('path') && !existingMenuColumns.includes('route')) {
      try {
        console.log('  Renaming path to route...');
        await sequelize.query('ALTER TABLE menus RENAME COLUMN path TO route');
        console.log('  ✅ Renamed path to route');
      } catch (error: any) {
        if (!error.message.includes('does not exist')) {
          console.error('  ⚠️  Error renaming path column:', error.message);
        }
      }
    }
    
    const menuColumnsToAdd = [
      { name: 'name_en', type: 'VARCHAR(100)' },
      { name: 'level', type: 'INTEGER DEFAULT 0' },
      { name: 'description', type: 'TEXT' }
    ];
    
    // Re-check columns after rename
    const [menuColumnsAfter] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'menus'
    `);
    const existingMenuColumnsAfter = (menuColumnsAfter as any[]).map((r: any) => r.column_name);
    
    for (const col of menuColumnsToAdd) {
      if (!existingMenuColumnsAfter.includes(col.name)) {
        try {
          console.log(`  Adding column: ${col.name}...`);
          await sequelize.query(`ALTER TABLE menus ADD COLUMN ${col.name} ${col.type}`);
          console.log(`  ✅ Added column: ${col.name}`);
        } catch (error: any) {
          if (!error.message.includes('already exists')) {
            console.error(`  ⚠️  Error adding column ${col.name}:`, error.message);
          }
        }
      }
    }
    
    // Update name_en if it's null (only if name_ko exists)
    if (existingMenuColumnsAfter.includes('name_ko') && existingMenuColumnsAfter.includes('name_en')) {
      try {
        console.log('  Updating name_en values...');
        await sequelize.query(`
          UPDATE menus 
          SET name_en = name_ko 
          WHERE name_en IS NULL OR name_en = ''
        `);
        console.log('  ✅ Updated name_en values');
      } catch (error: any) {
        console.error('  ⚠️  Error updating name_en:', error.message);
      }
    }
    
    console.log('✅ Database columns fixed!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to fix database columns:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    process.exit(1);
  }
}

fixDatabaseColumns();

