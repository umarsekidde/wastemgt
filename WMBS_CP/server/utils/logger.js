const log = (level, ...args) => {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}]`, ...args);
};

module.exports = {
  info: (...args) => log('info', ...args),
  error: (...args) => log('error', ...args),
  warn: (...args) => log('warn', ...args),
  debug: (...args) => process.env.NODE_ENV === 'development' && log('log', ...args)
};
