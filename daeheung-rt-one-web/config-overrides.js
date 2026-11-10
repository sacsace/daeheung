/**
 * CRA ForkTsCheckerWebpackPlugin 기본 memoryLimit(2048MB) 때문에
 * 대형 TSX(ExpenseApproval 등)에서 heap OOM이 납니다.
 * 타입체크 워커 힙을 키우거나, DISABLE_FORK_TS_CHECKER=true 면 플러그인을 끕니다.
 */
module.exports = function override(config) {
  const disableChecker = String(process.env.DISABLE_FORK_TS_CHECKER || '').toLowerCase() === 'true';

  if (disableChecker) {
    config.plugins = (config.plugins || []).filter(
      (plugin) => !(plugin && plugin.constructor && plugin.constructor.name === 'ForkTsCheckerWebpackPlugin')
    );
    return config;
  }

  const plugin = (config.plugins || []).find(
    (p) => p && p.constructor && p.constructor.name === 'ForkTsCheckerWebpackPlugin'
  );
  if (plugin && plugin.options) {
    const limit = Number(process.env.TS_CHECKER_MEMORY_LIMIT || 8192);
    if (plugin.options.typescript && typeof plugin.options.typescript === 'object') {
      plugin.options.typescript.memoryLimit = limit;
    } else {
      plugin.options.memoryLimit = limit;
    }
  }

  return config;
};
