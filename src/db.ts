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

      _userTables: () => {
        return knex('User')
          .join('UserHealth', 'User.id', 'UserHealth.userId')
          .join('UserLogin', 'User.id', 'UserLogin.userId')
      },

      findById: async (id: number) => {
        return await db.User._userTables().first().where({ id })
      },

      findByEmail: async (email: string) => {
        return await db.User._userTables().first().where({ email })
      },

      findByAuthToken: async (token: string): Promise<User | false> => {
        const userId = tokenMap[token]
        if (!userId) return false
        return db.User.findById(userId)
      },

      findAll: async () => {
        return db.User._userTables().select()
      },

      create: async (email: string, password: string) => {
        const passwordHash = hashPassword(email, password)
        const role = 'DOCTOR' // TODO
        const [userId] = await knex('User').insert({ role, email })
        await knex('UserLogin').insert({ userId, passwordHash })
        await knex('UserHealth').insert({ userId })
        return db.User.findById(userId)
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
