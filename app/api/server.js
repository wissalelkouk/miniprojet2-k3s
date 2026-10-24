const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

app.get('/health', (req, res) => res.status(200).send('ok'));

app.get('/ready', async (req, res) => {
  try { await pool.query('SELECT 1'); res.status(200).send('ready'); }
  catch (e) { console.error('not ready:', e.message); res.status(503).send('db down'); }
});

app.get('/tasks', async (req, res) => {
  const r = await pool.query('SELECT * FROM tasks ORDER BY id');
  res.json(r.rows);
});
app.post('/tasks', async (req, res) => {
  if (!req.body.title || !req.body.title.trim()) return res.status(400).json({ error: 'title required' });
  const r = await pool.query('INSERT INTO tasks(title) VALUES($1) RETURNING *', [req.body.title]);
  console.log('created task', r.rows[0].id);
  res.status(201).json(r.rows[0]);
});
app.put('/tasks/:id', async (req, res) => {
  const r = await pool.query('UPDATE tasks SET done=$1 WHERE id=$2 RETURNING *', [req.body.done, req.params.id]);
  res.json(r.rows[0]);
});
app.delete('/tasks/:id', async (req, res) => {
  await pool.query('DELETE FROM tasks WHERE id=$1', [req.params.id]);
  res.status(204).end();
});

async function init() {
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query('CREATE TABLE IF NOT EXISTS tasks(id SERIAL PRIMARY KEY, title TEXT NOT NULL, done BOOLEAN DEFAULT false)');
      console.log('DB connection OK, table ready');
      return;
    } catch (e) { console.log('waiting for DB...', e.message); await new Promise(r => setTimeout(r, 2000)); }
  }
}
init();
app.listen(process.env.API_PORT, () => console.log('API listening on', process.env.API_PORT));
