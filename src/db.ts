import bcrypt from 'bcryptjs'
import Knex from 'knex'
import uuid from 'uuid/v4'
import { User, Role } from 'src/types.d'
import { ApolloServer, AuthenticationError, UserInputError, ForbiddenError, ValidationError } from 'apollo-server'

// For now, we're going to store authenticate tokens here. This is because authentication
// will happen on every request, so we're going to use this as an in-memory data store rather
// than hitting SQL every time.
let tokenMap: { [token: string]: number } = {}

const hashPassword = (email: string, password: string) => {
  const salt = bcrypt.genSaltSync(8)
  return bcrypt.hashSync(password, salt)
}

// For CCPA/GDPR/HIPPA reasons, we break our users up into multiple tables.
// This helper helps us put them back together again.
const userTables = (knex: Knex) => {
  return knex<User, User>('User')
    .join('UserHealth', 'User.id', 'UserHealth.userId')
    .join('UserLogin', 'User.id', 'UserLogin.userId')
}

function Db(knex: Knex) {

  const db = {

    Auth: {

      authenticate: async (email: string, password: string): Promise<string> => {
        const user = await db.User.findByEmail(email)
        if (!user) throw new AuthenticationError('Cannot find user with that email address!')

        const hasCorrectPassword = bcrypt.compareSync(password, user.passwordHash)
        if (!hasCorrectPassword) throw new AuthenticationError('Incorrect email/password combination.')

        const token = uuid()
        tokenMap[token] = user.id

        return token
      },

      deauthenticate: async (token: string): Promise<true> => {
        const userId = tokenMap[token]
        if (!userId) throw new AuthenticationError('Invalid token.')
        delete tokenMap[token]
        return true
      },

    },

    User: {

      findById: async (id: number) => {
        return await userTables(knex).first().where({ id })
      },

      findByEmail: async (email: string) => {
        return await userTables(knex).first().where({ email })
      },

      findByAuthToken: async (token: string): Promise<User | false> => {
        const userId = tokenMap[token]
        if (!userId) return false
        return db.User.findById(userId)
      },

      findAll: async () => {
        return userTables(knex).select()
      },

      create: async (email: string, password: string, role: Role) => {
        const passwordHash = hashPassword(email, password)
        const [userId] = await knex('User').insert({ role, email })
        await knex('UserLogin').insert({ userId, passwordHash })
        await knex('UserHealth').insert({ userId })
        return db.User.findById(userId)
      },

    },

    _util: {
      resetDB: async () => {
        await knex.migrate.rollback(undefined, true)
        await knex.migrate.latest()
        tokenMap = {}
      }
    },

  }

  return db
}

export default Db
