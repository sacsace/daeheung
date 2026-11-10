import { connectDB } from '../src/models';
import { Menu } from '../src/models';
import sequelize from '../src/config/database';

async function checkMenuData() {
  try {
    console.log('🚀 Checking menu data...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    // Check menus table
    const [menus] = await sequelize.query(`
      SELECT id, tenant_id, name_ko, name_en, route, icon, "order", level, is_active, parent_id
      FROM menus
      WHERE tenant_id = 1
      ORDER BY "order" ASC
    `);
    
    console.log(`\nFound ${(menus as any[]).length} menus:`);
    (menus as any[]).forEach((menu: any) => {
      console.log(`  - ID: ${menu.id}, Name: ${menu.name_ko} (${menu.name_en}), Route: ${menu.route}, Order: ${menu.order}, Active: ${menu.is_active}`);
    });
    
    // Check if menus table has required columns
    const [columns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'menus'
      ORDER BY ordinal_position
    `);
    
    console.log(`\nMenu table columns:`);
    (columns as any[]).forEach((col: any) => {
      console.log(`  - ${col.column_name}`);
    });
    
    // Try to query using Sequelize model
    console.log(`\nTrying Sequelize query...`);
    const menuModels = await Menu.findAll({
      where: { tenant_id: 1, is_active: true },
      order: [['order', 'ASC']],
      attributes: ['id', 'tenant_id', 'parent_id', 'name_ko', 'name_en', 'route', 'icon', 'order', 'level', 'is_active', 'description']
    });
    
    console.log(`Sequelize found ${menuModels.length} menus`);
    menuModels.forEach((menu: any) => {
      const data = menu.toJSON();
      console.log(`  - ${data.name_ko} (${data.name_en})`);
    });
    
    console.log('\n✅ Menu data check completed!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to check menu data:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    process.exit(1);
  }
}

checkMenuData();

