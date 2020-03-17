import bcrypt from 'bcryptjs'
import Knex from 'knex'
import uuid from 'uuid/v4'
import * as T from 'src/types.d'
import { ApolloServer, AuthenticationError, UserInputError, ForbiddenError, ValidationError } from 'apollo-server'
import * as _ from 'lodash'

function Db(knex: Knex) {

  const db = {

    Auth: {

      authenticate: async (email: string, password: string): Promise<string> => {
        const user = await db.User.findByEmail(email)
        if (!user) throw new AuthenticationError('Cannot find user with that email address!')

        const hasCorrectPassword = bcrypt.compareSync(password, user.passwordHash)
        if (!hasCorrectPassword) throw new AuthenticationError('Incorrect email/password combination.')

        const token = uuid()
        await knex('UserToken').insert({ userId: user.id, token })

        return token
      },

      deauthenticate: async (token: string): Promise<true> => {
        await knex('UserToken').where({ token }).delete()
        return true
      },

    },

    User: {

      create: async (email: string, password: string, role: T.Role, name: string) => {
        const passwordHash = hashPassword(email, password)
        const [userId] = await knex('User').insert({ role, email, name })
        await knex('UserLogin').insert({ userId, passwordHash })
        await knex('UserHealth').insert({ userId })
        return db.User.findById(userId)
      },

      update: async (update: Pick<T.User, 'id' | 'role' | 'email' | 'name' | 'imageUrl' | 'birthday'>) => {
        await knex('User').where({ id: update.id }).update(update)
        return db.User.findById(update.id)
      },

      findById: async (id: number) => {
        return await userTables(knex).first().where({ id })
      },

      findByEmail: async (email: string) => {
        return await userTables(knex).first().where({ email })
      },

      findByAuthToken: async (token: string): Promise<T.User | false> => {
        const userTokenInfo = await knex('UserToken').where({ token }).first()
        if (!userTokenInfo) return false
        return db.User.findById(userTokenInfo.userId)
      },

      findAll: async () => {
        return userTables(knex).select()
      },

      findPatientsByDoctorId: async (doctorId: number) => {
        return await knex('DoctorPatientRelationship')
          .join('User', 'DoctorPatientRelationship.patientId', 'User.id')
          .where({ doctorId })
      },

      findDoctorsForPatientId: async (patientId: number) => {
        return await knex('DoctorPatientRelationship')
          .join('User', 'DoctorPatientRelationship.doctorId', 'User.id')
          .where({ patientId })
      },

      createDoctorPatientAssociation: async (doctorId: number, patientId: number) => {
        await knex('DoctorPatientRelationship').insert({ doctorId, patientId })
        return true
      },

      destroyDoctorPatientAssociation: async (doctorId: number, patientId: number) => {
        await knex('DoctorPatientRelationship').where({ doctorId, patientId }).delete()
        return true
      },

      recordVisit: async (userId: number) => {
        const now = (new Date()).valueOf()
        return knex.raw('UPDATE UserLogin SET lastVisit = NOW() WHERE userId = ?', [userId])
      },

    },

    Questionnaire: {

      // If the userId is supplied, we'll try to dig up their responses as well.
      findById: async (id: number, userId?: number): Promise<T.Questionnaire | null> => {
        const questionnaire = await knex<{}, T.Questionnaire>('Questionnaire').where({ id }).first()
        if (!questionnaire) return null
        questionnaire.questions = await db.Question.findByQuestionnaireId(questionnaire.id, userId)
        return questionnaire
      },

      all: async (userId?: number) => {
        const questionnaires = await knex('Questionnaire').select()
        return Promise.all(questionnaires.map(async questionnaire => {
          questionnaire.questions = await db.Question.findByQuestionnaireId(questionnaire.id, userId)
          return questionnaire
        }))
      },

      create: async (questionnaire: Omit<T.Questionnaire, 'id'>) => {
        const [questionnaireId] = await knex('Questionnaire').insert({ title: questionnaire.title })

        await Promise.all(questionnaire.questions.map(async q => {
          const [questionId] = await knex('Question').insert({ type: q.type, text: q.text, questionnaireId })

          if (!canHaveOptions(q)) return

          await Promise.all(q.options.map(async o => {
            return knex('QuestionOption').insert({ questionId, value: o.value, text: o.text })
          }))
        }))

        return db.Questionnaire.findById(questionnaireId)
      },

      delete: async (id: number) => {
        return knex('Questionnaire').where({ id }).delete()
      },

      createQuestionRelations: async (relations: T.QuestionRelation[]) => {
        await Promise.all(relations.map(async relation => {
          await knex('QuestionRelation').insert(relation)
        }))
      },

      submitBooleanQuestionResponse: async (userId: string, questionId: string, value: boolean) => {
        await knex('QuestionResponseBoolean').insert({ userId, questionId, value })
        return true
      },

      submitTextQuestionResponse: async (userId: string, questionId: string, value: string) => {
        await knex('QuestionResponseText').insert({ userId, questionId, value })
        return true
      },

      submitChoiceQuestionResponse: async (userId: string, questionId: string, value: string) => {
        const option = await knex<{}, T.QuestionOption>('QuestionOption').select('id').where({ questionId, value }).first()
        if (!option) throw new Error('Could not find specified option')
        const optionId = option.id
        await knex('QuestionResponseChoice').insert({ userId, questionId, optionId })
        return true
      },

    },

    Question: {

      findById: async (id: number, userId?: number) => {
        const questions = await db.Question._findWhere({ id }, userId)
        if (!questions) return undefined
        return questions[0]
      },

      findByQuestionnaireId: async (id: number, userId?: number) => {
        return db.Question._findWhere({ questionnaireId: id }, userId)
      },

      create: async (questions: T.Question[]) => {
        return await Promise.all(questions.map(async q => {
          const [questionId] = await knex('Question').insert({ questionnaireId: q.questionnaireId, text: q.text, type: q.type })

          q.options?.forEach(async o => {
            await knex('QuestionOption').insert({ questionId, value: o.value, text: o.text })
          })

          return Object.assign({ id: questionId }, q)
        }))
      },

      delete: async (id: number) => {
        return knex('Question').where({ id }).delete()
      },

      _findWhere: async (where: Partial<T.Question>, userId?: number): Promise<T.Question[]> => {
        let questions = await knex<{}, T.Question[]>('Question').where(where)

        await Promise.all(questions.map(async q => {
          // Grab each question relation and assign to question
          q.next = await knex<{}, T.QuestionRelation[]>('QuestionRelation').where({ questionId: q.id })

          // If questions can have options, grab em and stick em onto the question
          if (canHaveOptions(q))
            q.options = await knex<{}, T.QuestionOption[]>('QuestionOption').where({ questionId: q.id })
        }))

        if (!userId) return questions

        // If there's a user attached, we'll try to dig up their responses as well.
        await Promise.all(questions.map(async q => {
          const questionId = q.id

          if (q.type === 'BOOLEAN') {
            const booleanResponse = await knex<{}, T.DBQuestionResponseBoolean>('QuestionResponseBoolean').where({ questionId, userId }).first()
            q.response = !!booleanResponse?.value // MySQL stores bool as binary
          } else if (q.type === 'TEXT') {
            const textResponse = await knex<{}, T.DBQuestionResponseText>('QuestionResponseText').where({ questionId, userId }).first()
            q.response = textResponse?.value
          } else if (q.type === 'SINGLE_CHOICE') {
            const choiceResponse = await knex<{}, T.DBQuestionResponseChoice>('QuestionResponseChoice').where({ questionId, userId }).first()
            const choiceOption = q.options.find(o => o.id === choiceResponse?.optionId)
            q.response = choiceOption?.value
          } else if (q.type === 'MULTIPLE_CHOICE') {
            const choiceResponses = await knex<{}, T.DBQuestionResponseChoice[]>('QuestionResponseChoice').where({ questionId, userId })
            const choiceOptions = choiceResponses.map(response => q.options.find(option => option.id === response.optionId))
            q.response = choiceOptions.map(o => o.value)
          }
        }))

        return questions
      },

    },

    Timeline: {

      findItemById: async (id: number) => {
        return knex('TimelineItem').where({ id }).first()
      },

      findGroupById: async (id: number) => {
        return knex('TimelineGroup').where({ id }).first()
      },

      itemsByUserId: async (userId: number) => {
        return knex('TimelineItem').where({ userId })
      },

      groups: async () => {
        const groups = await knex<{}, T.TimelineGroup[]>('TimelineGroup').select()
        return Promise.all(groups.map(async group => {
          group.nestedGroups = await knex('TimelineGroupNesting').where({ groupId: group.id })
          return group
        }))
      },

      createItem: async (item: T.TimelineItem) => {
        item = sanitizeTimelineItem(item)
        const [id] = await knex('TimelineItem').insert(item)
        return knex('TimelineItem').where({ id }).first()
      },

      updateItem: async (update: Partial<T.TimelineItem>) => {
        update = sanitizeTimelineItem(update)
        await knex('TimelineItem').where({ id: update.id }).update(update)
        return db.Timeline.findItemById(update.id)
      },

      updateGroup: async (update: Partial<T.TimelineGroup>) => {
        await knex('TimelineGroup').where({ id: update.id }).update(update)
        return db.Timeline.findGroupById(update.id)
      },

      createGroup: async (group: T.TimelineGroup) => {
        const [id] = await knex('TimelineGroup').insert(group)
        return knex('TimelineGroup').where({ id }).first()
      },

    },

    _util: {
      // It doesn't need to be said that this is a test only function. Calling this against
      // a live DB will result in epic disaster.
      clearDb: async () => {
        for (let table of [
          'DoctorPatientRelationship',
          'TimelineGroupNesting', 'TimelineItem', 'TimelineGroup',
          'QuestionRelation',
          'QuestionResponseBoolean', 'QuestionResponseText', 'QuestionResponseChoice',
          'QuestionOption', 'Question',
          'Questionnaire',
          'UserToken', 'UserHealth', 'UserLogin', 'User',
        ]) {
          try {
            await knex.raw(`DELETE FROM ${table}`)
          } catch (e) {
            console.error('Got an error deleting from table:', table)
            throw e
          }
        }
      },

      // It doesn't need to be said here as well. (see above)
      migrateDownAndUp: async () => {
        // This will reset the DB, but it's slow as the dickens. Great to do once before
        // tests are run, but too slothful to do for each individual test.
        try {
          await knex.raw(`DELETE FROM knex_migrations_lock`)
        } catch (e) {
          // The issue is that knex_migrations_lock doesn't exist on new installs.
          // So if this fails we're actually totally fine.
        }
        await knex.migrate.rollback(undefined, true)
        await knex.migrate.latest()
      }
    },

  }

  return db
}

const hashPassword = (email: string, password: string) => {
  const salt = bcrypt.genSaltSync(8)
  return bcrypt.hashSync(password, salt)
}

// For CCPA/GDPR/HIPPA reasons, we break our users up into multiple tables.
// This helper helps us put them back together again.
const userTables = (knex: Knex) => {
  return knex<{}, T.User>('User')
    .join('UserHealth', 'User.id', 'UserHealth.userId')
    .join('UserLogin', 'User.id', 'UserLogin.userId')
}

// Helper to know if a question is of the type that has options on it
const canHaveOptions = (question: T.Question) => {
  return ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(question.type)
}

// Ensures timeline item is correct format _to go into the database_
const sanitizeTimelineItem = <T extends Partial<T.TimelineItem>>(item: T) => {
  if (item.start) item.start = new Date(item.start)
  if (item.end) item.end = new Date(item.end)
  return item
}

export default Db
