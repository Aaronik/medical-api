import Knex from 'knex'

const knex = Knex({
  client: 'mysql',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    password: 'secret',
    database: 'milli_db_test',
    port: 3307
  }
})

export default knex
