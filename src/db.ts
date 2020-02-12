import Knex from 'knex'

const knexConfig = require('../knexfile')

const knex = Knex(knexConfig)

export default {
  User: {
    findById: async (id: string) => {
      const user = await knex('User').select().where({ id })
      return user[0]
    },
    findAll: async () => {
      return knex('User').select()
    },
  },
}
