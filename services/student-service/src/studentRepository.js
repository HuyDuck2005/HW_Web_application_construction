const TABLE_NAME = "students";

export function createStudentRepository(db) {
  return {
    async create(student) {
      const [created] = await db(TABLE_NAME)
        .insert(student)
        .returning(["id", "name", "email", "status", "created_at", "updated_at"]);

      return created;
    },

    async findById(id) {
      return db(TABLE_NAME)
        .select("id", "name", "email", "status")
        .where("id", id)
        .first();
    },

    async findByEmailWithPassword(email) {
      return db(TABLE_NAME)
        .select("id", "name", "email", "password", "status")
        .where({ email })
        .first();
    },

    async findAll({ limit, offset }) {
      return db(TABLE_NAME)
        .select("id", "name", "email", "status")
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset);
    },

    async countAll() {
      const row = await db(TABLE_NAME).count({ count: "*" }).first();
      return Number(row.count);
    },

    async findByIds(ids) {
      if (!ids || ids.length === 0) return [];

      return db(TABLE_NAME).select("id", "name", "email", "status").whereIn("id", ids);
    },
  };
}
