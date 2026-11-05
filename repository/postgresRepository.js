const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

class PostgresTaskRepository {
  async getAll() {
    const res = await pool.query('SELECT * FROM tasks ORDER BY id');
    return res.rows;
  }

  async getById(id) {
    const res = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async create({ title }) {
    const res = await pool.query(
      'INSERT INTO tasks (title, done) VALUES ($1, false) RETURNING *',
      [title]
    );
    return res.rows[0];
  }

  async update(id, { title, done }) {
    const res = await pool.query(
      'UPDATE tasks SET title = COALESCE($1, title), done = COALESCE($2, done) WHERE id = $3 RETURNING *',
      [title, done, id]
    );
    return res.rows[0] || null;
  }

  async delete(id) {
    const res = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
    return res.rows[0] || null;
  }
}

module.exports = PostgresTaskRepository;