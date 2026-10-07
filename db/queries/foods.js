/**
 * queries/foods.js: Nutritional catalog search, sorting, pagination, and custom food creation
 */

const { getDb } = require('../connection');

const ALLOWED_SORT_COLUMNS = ['name', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'protein_density', 'created_at'];

function search(options = {}, dbInstance = null) {
  const db = dbInstance || getDb();

  const q = options.q ? `%${options.q.trim()}%` : null;
  const category = (options.category && options.category !== 'all') ? options.category.trim() : null;
  const sort = ALLOWED_SORT_COLUMNS.includes(options.sort) ? options.sort : 'protein_g';
  const order = (options.order && options.order.toLowerCase() === 'asc') ? 'ASC' : 'DESC';

  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(options.limit, 10) || 20));
  const offset = (page - 1) * limit;

  // Build WHERE clauses with parameterized bindings
  const whereClauses = [];
  const params = [];

  if (q) {
    whereClauses.push('name LIKE ?');
    params.push(q);
  }

  if (category) {
    whereClauses.push('category = ?');
    params.push(category);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get total count
  const countSql = `SELECT COUNT(*) AS total FROM foods ${whereSql}`;
  const total = db.prepare(countSql).get(...params).total;

  // Get paginated rows
  const querySql = `
    SELECT * FROM foods
    ${whereSql}
    ORDER BY ${sort} ${order}
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(querySql).all(...params, limit, offset);

  return {
    rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1
  };
}

function getById(id, dbInstance = null) {
  const db = dbInstance || getDb();
  return db.prepare('SELECT * FROM foods WHERE id = ?').get(id) || null;
}

function createCustom(foodData, dbInstance = null) {
  const db = dbInstance || getDb();

  const name = foodData.name;
  const category = foodData.category || 'other';
  const serving_label = foodData.serving_label || '1 serving';
  const serving_g = Number(foodData.serving_g) || 100;
  const calories = Number(foodData.calories) || 0;
  const protein_g = Number(foodData.protein_g) || 0;
  const carbs_g = Number(foodData.carbs_g) || 0;
  const fat_g = Number(foodData.fat_g) || 0;

  // Compute protein density (percentage of calories from protein)
  let protein_density = foodData.protein_density;
  if (protein_density === undefined || protein_density === null) {
    protein_density = calories > 0 ? Number(((protein_g * 4 / calories) * 100).toFixed(1)) : 0;
  }

  const created_by = foodData.created_by || null;

  const stmt = db.prepare(`
    INSERT INTO foods (
      name, category, serving_label, serving_g, calories,
      protein_g, carbs_g, fat_g, protein_density, is_custom, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);

  const result = stmt.run(
    name, category, serving_label, serving_g, calories,
    protein_g, carbs_g, fat_g, protein_density, created_by
  );

  return getById(result.lastInsertRowid, db);
}

module.exports = {
  search,
  getById,
  createCustom
};
