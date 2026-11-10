 'use strict';
 
 /** @type {import('sequelize-cli').Migration} */
 module.exports = {
   async up(queryInterface) {
     const [accountingMenus] = await queryInterface.sequelize.query(`
       SELECT id, tenant_id
       FROM menus
       WHERE route = '/accounting' AND level = 1
     `);
 
     for (const menu of accountingMenus) {
       const [existing] = await queryInterface.sequelize.query(
         `
         SELECT id FROM menus
         WHERE tenant_id = $1 AND parent_id = $2 AND route = '/accounting/basic-info'
         `,
         { bind: [menu.tenant_id, menu.id] }
       );
 
       if (existing.length > 0) {
         continue;
       }
 
       const [orderRows] = await queryInterface.sequelize.query(
         `
         SELECT COALESCE(MAX("order"), 0) AS max_order
         FROM menus
         WHERE tenant_id = $1 AND parent_id = $2
         `,
         { bind: [menu.tenant_id, menu.id] }
       );
 
       const nextOrder = Number(orderRows?.[0]?.max_order || 0) + 1;
 
       await queryInterface.sequelize.query(
         `
         INSERT INTO menus (
           tenant_id, parent_id, name_ko, name_en, route, icon, "order", level, is_active, description, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, 2, true, $8, NOW(), NOW()
         )
         `,
         {
           bind: [
             menu.tenant_id,
             menu.id,
             '회계 기본정보 관리',
             'Accounting Basic Info',
             '/accounting/basic-info',
             'category',
             nextOrder,
             'Accounting basic master data'
           ]
         }
       );
     }
   },
 
   async down(queryInterface) {
     await queryInterface.sequelize.query(`
       DELETE FROM menus
       WHERE route = '/accounting/basic-info'
     `);
   }
 };
