import { seedDaeheungData } from '../src/data/daeheungSeed';
import { connectDB } from '../src/models';
import bcrypt from 'bcryptjs';
import { User, Tenant, Company, Menu } from '../src/models';
import sequelize from '../src/config/database';

async function seedDatabase() {
  try {
    console.log('🚀 Database seeding started...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    // Check if tenants table has required columns
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tenants' AND column_name IN ('trial_ends_at', 'subscription_id', 'subdomain', 'plan', 'max_users', 'max_companies', 'features')
    `);
    
    const existingColumns = (results as any[]).map((r: any) => r.column_name);
    console.log('Existing columns:', existingColumns);
    
    // Add missing columns if needed
    if (!existingColumns.includes('subdomain')) {
      console.log('Adding subdomain column...');
      await sequelize.query('ALTER TABLE tenants ADD COLUMN subdomain VARCHAR(100) UNIQUE');
    }
    if (!existingColumns.includes('plan')) {
      console.log('Adding plan column...');
      await sequelize.query("ALTER TABLE tenants ADD COLUMN plan VARCHAR(50) DEFAULT 'basic'");
    }
    if (!existingColumns.includes('max_users')) {
      console.log('Adding max_users column...');
      await sequelize.query('ALTER TABLE tenants ADD COLUMN max_users INTEGER DEFAULT 10');
    }
    if (!existingColumns.includes('max_companies')) {
      console.log('Adding max_companies column...');
      await sequelize.query('ALTER TABLE tenants ADD COLUMN max_companies INTEGER DEFAULT 1');
    }
    if (!existingColumns.includes('features')) {
      console.log('Adding features column...');
      await sequelize.query("ALTER TABLE tenants ADD COLUMN features JSON DEFAULT '[]'");
    }
    if (!existingColumns.includes('trial_ends_at')) {
      console.log('Adding trial_ends_at column...');
      await sequelize.query('ALTER TABLE tenants ADD COLUMN trial_ends_at TIMESTAMP');
    }
    if (!existingColumns.includes('subscription_id')) {
      console.log('Adding subscription_id column...');
      await sequelize.query('ALTER TABLE tenants ADD COLUMN subscription_id VARCHAR(255)');
    }
    
    // Minsub Ventures 기본 데이터 (회사·메뉴·권한·샘플 거래)
    await seedDaeheungData();
    
    // Update user passwords with proper bcrypt hashes
    console.log('🔐 Updating user passwords...');
    const users = await User.findAll({ where: { tenant_id: 1 } });
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    for (const user of users) {
      await user.update({ password_hash: passwordHash });
      console.log(`  ✅ Updated password for user: ${user.userid}`);
    }
    
    // Create test users if they don't exist
    const testUsers = [
      { userid: 'root', username: 'Root User', email: 'root@mvs3.com', role: 'root' as const },
      { userid: 'admin', username: 'Admin User', email: 'admin@mvs3.com', role: 'admin' as const },
      { userid: 'user1', username: 'User One', email: 'user1@mvs3.com', role: 'user' as const }
    ];
    
    for (const testUser of testUsers) {
      const [user, created] = await User.findOrCreate({
        where: { userid: testUser.userid, tenant_id: 1 },
        defaults: {
          ...testUser,
          tenant_id: 1,
          company_id: 1,
          password_hash: passwordHash,
          status: 'active' as const
        }
      });
      
      if (!created) {
        await user.update({ password_hash: passwordHash });
      }
      console.log(`  ✅ ${created ? 'Created' : 'Updated'} test user: ${testUser.userid}`);
    }
    
    console.log('✅ Database seeding completed!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Database seeding failed:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    process.exit(1);
  }
}

seedDatabase();
