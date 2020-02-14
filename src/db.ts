import bcrypt from 'bcryptjs'
import Knex from 'knex'
import uuid from 'uuid/v4'
import User from 'types/User'
import { ApolloServer, AuthenticationError, UserInputError, ForbiddenError, ValidationError } from 'apollo-server'

// For now, we're going to store authenticate tokens here. This is because authentication
// will happen on every request, so we're going to use this as an in-memory data store rather
// than hitting SQL every time.
let tokenMap: { [token: string]: number } = {}

const hashPassword = (email: string, password: string) => {
  const salt = bcrypt.genSaltSync(8)
  return bcrypt.hashSync(password, salt)
}

function Db(knex: Knex) {

  const db = {
    _util: {
      resetDB: async () => {
        await knex.migrate.rollback(undefined, true)
        await knex.migrate.latest()
        tokenMap = {}
      }
    },
    User: {
      findById: async (id: number) => {
        const user = await knex('User').select().where({ id })
        return user[0]
      },
      findByEmail: async (email: string) => {
        const user = await knex('User').select().where({ email })
        return user[0]
      },
      findByAuthToken: async (token: string): Promise<User | false> => {
        const userId = tokenMap[token]
        if (!userId) return false
        return db.User.findById(userId)
      },
      findAll: async () => {
        return knex('User').select()
      },
      create: async (email: string, password: string) => {
        const passwordHash = hashPassword(email, password)
        const role = 'DOCTOR' // TODO
        const newUserId = await knex('User').insert({ passwordHash, role, email })
        return db.User.findById(newUserId[0])
      },
    },
    Auth: {
      authenticate: async (email: string, password: string) => {
        const user = await db.User.findByEmail(email)
        if (!user) throw new AuthenticationError('Cannot find user with that email address!')
        const hasCorrectPassword = bcrypt.compareSync(password, user.passwordHash)
        if (!hasCorrectPassword) throw new AuthenticationError('Incorrect email/password combination.')
        const token = uuid()
        tokenMap[token] = user.id
        return token
      },
      deauthenticate: async (token: string) => {
        const userId = tokenMap[token]
        if (!userId) throw new AuthenticationError('Invalid token.')
        delete tokenMap[token]
        return true
      },
    },
  }

  return db
}

export default Db
