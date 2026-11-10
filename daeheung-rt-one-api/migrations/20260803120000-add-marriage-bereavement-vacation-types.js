'use strict';

/**
 * 결혼휴가(marriage), 조사 휴가(bereavement) 타입 지원.
 * vacation_type이 아직 enum인 DB만 VARCHAR로 변환 (이미 VARCHAR면 무시).
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'vacations'
            AND column_name = 'vacation_type'
            AND udt_name = 'enum_vacations_vacation_type'
        ) THEN
          ALTER TABLE vacations
            ALTER COLUMN vacation_type TYPE VARCHAR(50)
            USING vacation_type::text;
        END IF;
      END
      $$;
    `);
  },

  async down() {
    // VARCHAR → enum 복원은 생략
  },
};
