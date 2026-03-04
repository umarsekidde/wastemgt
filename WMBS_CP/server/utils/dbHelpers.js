/**
 * DB-agnostic helpers so the app works with both MySQL (local) and PostgreSQL (e.g. Render).
 */

function getMonthExpr(sequelize, colName = 'created_at') {
  const dialect = sequelize.getDialect();
  if (dialect === 'postgres') {
    const expr = sequelize.fn('to_char', sequelize.col(colName), sequelize.literal("'YYYY-MM'"));
    return { expr, group: expr };
  }
  const expr = sequelize.fn('DATE_FORMAT', sequelize.col(colName), '%Y-%m');
  return { expr, group: expr };
}

module.exports = { getMonthExpr };
