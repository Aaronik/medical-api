import Knex from 'knex'
import bcrypt from 'bcryptjs'

const knexConfig = require('../knexfile')

const knex = Knex(knexConfig)

const db = {
  User: {
    findById: async (id: string) => {
      const user = await knex('User').select().where({ id })
      return user[0]
    },
    findAll: async () => {
      return knex('User').select()
    },
    create: async ({ email, password }: { email: string, password: string }) => {
      const salt = bcrypt.genSaltSync(8)
      const passwordHash = bcrypt.hashSync(password, salt)
      const role = 'DOCTOR' // TODO
      const newUserId = await knex('User').insert({ passwordHash, role, email }).returning('*')
      return db.User.findById(newUserId[0])
    }
  },
}

export default db
