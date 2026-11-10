import { connectDB } from '../src/models';
import sequelize from '../src/config/database';

async function fixMenuOrderColumn() {
  try {
    console.log('🚀 Fixing menus order column...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    // Check if order_num exists and order doesn't
    const [columns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'menus' AND column_name IN ('order', 'order_num')
    `);
    
    const existingColumns = (columns as any[]).map((r: any) => r.column_name);
    console.log('Existing order columns:', existingColumns);
    
    if (existingColumns.includes('order_num') && !existingColumns.includes('order')) {
      console.log('  Renaming order_num to order...');
      await sequelize.query('ALTER TABLE menus RENAME COLUMN order_num TO "order"');
    } else if (!existingColumns.includes('order')) {
      console.log('  Adding order column...');
      await sequelize.query('ALTER TABLE menus ADD COLUMN "order" INTEGER DEFAULT 0');
      if (existingColumns.includes('order_num')) {
        console.log('  Copying data from order_num to order...');
        await sequelize.query('UPDATE menus SET "order" = order_num WHERE "order" IS NULL');
      }
    }
    
    console.log('✅ Menu order column fixed!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to fix menu order column:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    process.exit(1);
  }
}

fixMenuOrderColumn();

