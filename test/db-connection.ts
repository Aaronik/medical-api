import Knex from 'knex'

const knex = Knex({
  client: 'mysql',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'secret',
    database: process.env.DB_DB || 'milli_db_test',
    port: Number(process.env.DB_PORT) || 3307
  }
})

export default knex
