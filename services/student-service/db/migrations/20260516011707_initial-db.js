export async function up(knex) {
    await knex.schema.createTable("students", table => {
        table.uuid("id").primary();
        table.string("name", 150).notNullable();
        table.string("email", 150).notNullable().unique();
        table.string("password", 255).notNullable();
        table.string("status", 30).notNullable().defaultTo("ACTIVE");
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
};

export async function down(knex) {
    await knex.schema.dropTableIfExists("students");
};