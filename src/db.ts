import Knex from 'knex'

const knexConfig = require('../knexfile')

const knex = Knex(knexConfig)

export default {
  User: {
    findById: async (id: string) => knex.raw('SELECT * FROM user WHERE id = ?', [id]),
    findAll: async () => knex.raw('SELECT * FROM user'),
  },
  Test: {
    listTables: async () => knex.raw('show tables;'),
  }
}
