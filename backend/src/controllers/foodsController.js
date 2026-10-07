const db = require('../db/database');
const AppError = require('../utils/errors');

/**
 * Get paginated, searchable, sortable list of verified & user-created foods.
 */
async function getFoods(req, res, next) {
  try {
    const {
      search = '',
      category = '',
      sort = 'protein_g',
      order = 'desc',
      page = 1,
      limit = 15
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 15));
    const offset = (pageNum - 1) * limitNum;

    const allowedSortFields = ['name', 'category', 'protein_g', 'calories', 'carbs_g', 'fat_g', 'serving_g'];
    const safeSort = allowedSortFields.includes(sort) ? sort : 'protein_g';
    const safeOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions = [];
    const params = [];

    // Filter by search query across name
    if (search && search.trim()) {
      conditions.push('f.name LIKE ?');
      params.push(`%${search.trim()}%`);
    }

    // Filter by category (supports both raw DB categories and UI filter aliases)
    if (category && category.trim() && category !== 'all') {
      const cat = category.trim().toLowerCase();
      if (cat === 'vegetarian' || cat === 'plant-based') {
        conditions.push("f.category IN ('dairy', 'eggs', 'legumes', 'grains', 'nuts', 'plant_protein', 'vegetarian', 'plant-based')");
      } else if (cat === 'poultry' || cat === 'seafood') {
        conditions.push("f.category IN ('meat', 'fish', 'poultry', 'seafood')");
      } else if (cat === 'high-protein') {
        conditions.push('((f.protein_g / NULLIF(f.serving_g, 0)) * 100) >= 20');
      } else if (cat === 'low-cal') {
        conditions.push('f.calories < 150');
      } else {
        conditions.push('f.category = ?');
        params.push(cat);
      }
    }

    // Include system foods (is_custom = 0) OR custom foods created by this athlete
    const currentUserId = req.user ? req.user.id : null;
    if (currentUserId) {
      conditions.push('(f.is_custom = 0 OR f.created_by = ?)');
      params.push(currentUserId);
    } else {
      conditions.push('f.is_custom = 0');
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count for pagination
    const countSql = `SELECT COUNT(*) as count FROM foods f ${whereClause}`;
    const countResult = await db.queryOne(countSql, params);
    const total = countResult ? countResult.count : 0;

    // Fetch items with density calculation
    const querySql = `
      SELECT f.id, f.name, f.category, f.serving_label, f.serving_g,
             f.calories, f.protein_g, f.carbs_g, f.fat_g, f.is_custom, f.created_by,
             ROUND((f.protein_g * 4.0 / NULLIF(f.calories, 0)) * 100, 1) as protein_calorie_pct,
             ROUND((f.protein_g / NULLIF(f.serving_g, 0)) * 100, 1) as protein_density_pct
      FROM foods f
      ${whereClause}
      ORDER BY ${safeSort} ${safeOrder}
      LIMIT ? OFFSET ?
    `;

    const foods = await db.query(querySql, [...params, limitNum, offset]);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      foods,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        total_pages: totalPages,
        totalPages
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get single food by ID.
 */
async function getFoodById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const currentUserId = req.user ? req.user.id : null;

    const food = await db.queryOne(`
      SELECT f.id, f.name, f.category, f.serving_label, f.serving_g,
             f.calories, f.protein_g, f.carbs_g, f.fat_g, f.is_custom, f.created_by,
             ROUND((f.protein_g * 4.0 / NULLIF(f.calories, 0)) * 100, 1) as protein_calorie_pct,
             ROUND((f.protein_g / NULLIF(f.serving_g, 0)) * 100, 1) as protein_density_pct
      FROM foods f
      WHERE f.id = ? AND (f.is_custom = 0 OR f.created_by = ?)
    `, [id, currentUserId]);

    if (!food) {
      throw AppError.notFound('Food entry not found in database.', 'FOOD_NOT_FOUND');
    }

    res.json({ food });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a custom food (authenticated athlete).
 */
async function createCustomFood(req, res, next) {
  try {
    const {
      name,
      category = 'other',
      serving_label,
      serving_g,
      calories,
      protein_g,
      carbs_g = 0,
      fat_g = 0
    } = req.body;

    const result = await db.execute(`
      INSERT INTO foods (
        name, category, serving_label, serving_g, calories, protein_g, carbs_g, fat_g, is_custom, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `, [
      name.trim(),
      category.trim(),
      serving_label.trim(),
      serving_g,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      req.user.id
    ]);

    const food = await db.queryOne(`
      SELECT id, name, category, serving_label, serving_g, calories, protein_g, carbs_g, fat_g, is_custom, created_by,
             ROUND((protein_g * 4.0 / NULLIF(calories, 0)) * 100, 1) as protein_calorie_pct,
             ROUND((protein_g / NULLIF(serving_g, 0)) * 100, 1) as protein_density_pct
      FROM foods WHERE id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json({
      message: 'Custom food created successfully',
      food
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getFoods,
  getFoodById,
  createCustomFood
};
