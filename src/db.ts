import bcrypt from 'bcryptjs'
import Knex from 'knex'

function Db(knex: Knex) {

  const db = {
    _util: {
      resetDB: async () => {
        await knex.migrate.rollback(undefined, true)
        await knex.migrate.latest()
      }
    },
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
        const newUserId = await knex('User').insert({ passwordHash, role, email }).returning('id')
        return db.User.findById(newUserId[0])
      }
    }
  }

  return db
}

export default Db
