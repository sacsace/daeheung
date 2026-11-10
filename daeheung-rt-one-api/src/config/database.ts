import { Sequelize } from 'sequelize';
import { env } from './env';
import { SYSTEM_CONSTANTS } from './constants';

// Railway 환경 변수 우선 사용
const databaseUrl = process.env.DATABASE_URL;
const isRailwayInternal = Boolean(databaseUrl?.includes('.railway.internal'));
// 공개 프록시(rlwy.net)는 NODE_ENV=development 여도 SSL 필요. internal은 SSL 금지.
const databaseUrlNeedsSsl = Boolean(
  databaseUrl &&
    !isRailwayInternal &&
    (/rlwy\.net|railway\.app|sslmode=require/i.test(databaseUrl) ||
      env.NODE_ENV === 'production')
);

const sequelize = databaseUrl 
  ? new Sequelize(databaseUrl, {
      /** SQL 쿼리 로그는 기본 비활성. 필요 시 `SEQUELIZE_LOG=1` 로 켤 수 있음 */
      logging: process.env.SEQUELIZE_LOG === '1' ? console.log : false,
      pool: {
        max: SYSTEM_CONSTANTS.DB_POOL.MAX,
        min: SYSTEM_CONSTANTS.DB_POOL.MIN,
        acquire: SYSTEM_CONSTANTS.DB_POOL.ACQUIRE,
        idle: SYSTEM_CONSTANTS.DB_POOL.IDLE
      },
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true
      },
      dialectOptions: {
        ssl: databaseUrlNeedsSsl
          ? { require: true, rejectUnauthorized: false }
          : false
      }
    })
  : new Sequelize({
      dialect: 'postgres',
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      username: env.DB_USER,
      password: env.DB_PASSWORD,
      logging: process.env.SEQUELIZE_LOG === '1' ? console.log : false,
      pool: {
        max: SYSTEM_CONSTANTS.DB_POOL.MAX,
        min: SYSTEM_CONSTANTS.DB_POOL.MIN,
        acquire: SYSTEM_CONSTANTS.DB_POOL.ACQUIRE,
        idle: SYSTEM_CONSTANTS.DB_POOL.IDLE
      },
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true
      },
      dialectOptions: {
        // 로컬 개발 환경 SSL 설정
        ssl: false,
        rejectUnauthorized: false
      }
    });

export default sequelize;
