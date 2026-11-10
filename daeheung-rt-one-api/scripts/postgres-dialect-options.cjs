/**
 * Railway postgres.railway.internal 은 SSL 미사용.
 * 공개 프록시(rlwy.net) 등 외부 URL만 production SSL 적용.
 */
function getPostgresDialectOptions(databaseUrl) {
  const url = String(databaseUrl || '');
  const isRailwayInternal = url.includes('.railway.internal');

  if (isRailwayInternal || process.env.NODE_ENV !== 'production') {
    return { ssl: false };
  }

  return {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  };
}

module.exports = { getPostgresDialectOptions };
