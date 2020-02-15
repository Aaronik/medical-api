import bcrypt from 'bcryptjs'
import Knex from 'knex'
import uuid from 'uuid/v4'
import * as T from 'src/types.d'
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
  return knex<T.User, T.User>('User')
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

      findByAuthToken: async (token: string): Promise<T.User | false> => {
        const userId = tokenMap[token]
        if (!userId) return false
        return db.User.findById(userId)
      },

      findAll: async () => {
        return userTables(knex).select()
      },

      create: async (email: string, password: string, role: T.Role) => {
        const passwordHash = hashPassword(email, password)
        const [userId] = await knex('User').insert({ role, email })
        await knex('UserLogin').insert({ userId, passwordHash })
        await knex('UserHealth').insert({ userId })
        return db.User.findById(userId)
      },

    },

    Questionnaire: {

      findById: async (id: number) => {
        const questionnaire = await knex<T.Questionnaire, T.Questionnaire>('Questionnaire').select('*').where({ id }).first()
        const questions = await knex<T.Question, T.Question[]>('Question').select('*').where({ questionnaireId: id })

        const ps = questions.map(q => knex<T.QuestionOption[], T.QuestionOption[]>('QuestionOption').select().where({ questionId: q.id }))
        const [questionOptions] = await Promise.all(ps)

        questionOptions.forEach(o => {
          const question = questions.find((q) => q.id === o.questionId)
          if (!question.options) question.options = []
          question.options.push(o)
        })

        questionnaire.questions = questions

        return questionnaire

        // return knex<T.Questionnaire, T.Questionnaire>('Questionnaire')
        //   .leftJoin('Question', 'Questionnaire.id', 'Question.questionnaireId')
        //   .leftJoin('QuestionOption', 'Question.id', 'QuestionOption.questionId')
        //   .select('*')
        //   .first()
      },

      create: async (questionnaire: Omit<T.Questionnaire, 'id'>) => {
        const [questionnaireId] = await knex('Questionnaire').insert({ title: questionnaire.title })

        const ps = questionnaire.questions.map(async q => {
          const [questionId] = await knex('Question').insert({ type: q.type, text: q.text, questionnaireId })

          if (q.type !== 'SINGLE_CHOICE' && q.type !== 'MULTIPLE_CHOICE') return

          const ps = q.options.map(async o => {
            await knex('QuestionOption').insert({ questionId, value: o.value, text: o.text })
          })

          await Promise.all(ps)
        })

        await Promise.all(ps)

        return db.Questionnaire.findById(questionnaireId)
      }

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
