require('dotenv').config();
const express = require('express');
const TaskService = require('./service');
const PostgresTaskRepository = require('./repository/postgresRepository');

const repo = new PostgresTaskRepository();
const service = new TaskService(repo);

const app = express();
app.use(express.json());

app.get('/tasks', async (req, res) => {
  const tasks = await service.list();
  res.json(tasks);
});

app.get('/tasks/:id', async (req, res) => {
  const task = await service.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

app.post('/tasks', async (req, res) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }
  const task = await service.create({ title: title.trim() });
  res.status(201).json(task);
});

app.put('/tasks/:id', async (req, res) => {
  const task = await service.update(req.params.id, req.body);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

app.delete('/tasks/:id', async (req, res) => {
  const task = await service.remove(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.status(204).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));