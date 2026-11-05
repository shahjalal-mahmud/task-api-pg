class TaskService {
  constructor(repo) {
    this.repo = repo;
  }

  async list() { return this.repo.getAll(); }
  async get(id) { return this.repo.getById(id); }
  async create(data) { return this.repo.create(data); }
  async update(id, data) { return this.repo.update(id, data); }
  async remove(id) { return this.repo.delete(id); }
}

module.exports = TaskService;