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

      _findOne: async (where: any) => {
        const user = await userTables(knex).first().where(where)
        if (!user) return null
        user.patients = await db.User.findPatientsByDoctorId(user.id)
        user.doctors = await db.User.findDoctorsForPatientId(user.id)
        return user
      },

      findById: async (id: number) => {
        return await db.User._findOne({ id })
      },

      findByEmail: async (email: string) => {
        return await db.User._findOne({ email })
      },

      findAll: async () => {
        // TODO Need to do some clever joining to quicken this up, this is not scalable
        const userIds = await userTables(knex).select('id')
        return Promise.all(userIds.map(async ({ id }) => {
          return db.User._findOne({ id })
        }))
      },

      findByAuthToken: async (token: string): Promise<T.User | false> => {
        const userTokenInfo = await knex('UserToken').where({ token }).first()
        if (!userTokenInfo) return false
        return db.User.findById(userTokenInfo.userId)
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

      findAssignedToUser: async (userId: number) => {
        const questionnaireIds = await knex('QuestionnaireAssignment').select('questionnaireId').where({ assigneeId: userId })
        return Promise.all(questionnaireIds.map(({ questionnaireId }) => db.Questionnaire.findById(questionnaireId, userId)))
      },

      findMadeByUser: async (userId: number) => {
        const ids = await knex('Questionnaire').select('id').where({ creatingUserId: userId })
        return Promise.all(ids.map(({ id }) => db.Questionnaire.findById(id)))
      },

      all: async (userId?: number) => {
        const questionnaires = await knex('Questionnaire').select()
        return Promise.all(questionnaires.map(async questionnaire => {
          questionnaire.questions = await db.Question.findByQuestionnaireId(questionnaire.id, userId)
          return questionnaire
        }))
      },

      create: async (questionnaire: Omit<T.Questionnaire, 'id'>, userId: number) => {
        const [questionnaireId] = await knex('Questionnaire').insert({ title: questionnaire.title, creatingUserId: userId })

        await Promise.all(questionnaire.questions.map(async q => {
          const [questionId] = await knex('Question').insert({ type: q.type, text: q.text, questionnaireId })

          if (!canHaveOptions(q)) return

          await Promise.all(q.options.map(async o => {
            return knex('QuestionOption').insert({ questionId, text: o.text })
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
        try {
          await knex('QuestionResponseBoolean').insert({ userId, questionId, value })
          return true
        } catch (e) {
          await knex('QuestionResponseBoolean').where({ userId, questionId }).update({ value })
          return true
        }
      },

      submitTextQuestionResponse: async (userId: string, questionId: string, value: string) => {
        try {
          await knex('QuestionResponseText').insert({ userId, questionId, value })
          return true
        } catch (e) {
          await knex('QuestionResponseText').where({ userId, questionId }).update({ value })
          return true
        }
      },

      submitChoiceQuestionResponse: async (userId: string, questionId: number, optionId: number) => {
        const option = await knex<{}, T.QuestionOption>('QuestionOption').where({ id: optionId }).first()

        // we remove all the existing responses for this question
        await knex('QuestionResponseChoice').where({ userId, questionId: option.questionId }).delete()

        await knex('QuestionResponseChoice').insert({ userId, questionId: option.questionId, optionId })
        return true
      },

      submitChoiceQuestionResponses: async (userId: string, questionId: number, optionIds: number[]) => {
        await ensureOptionsAreForSingleQuestion(knex, questionId, optionIds)

        // we remove all the existing responses for this question
        await knex('QuestionResponseChoice').where({ userId, questionId }).delete()

        // If the user wants to remove all their options, we're done
        if (optionIds.length === 0) return true

        // Find out what question these are for. They all have to be for the same question, so we'll check the first
        // and assume it's the same with the rest. If not, the DB will throw.
        const firstOption = await knex('QuestionOption').where({ id: optionIds[0] }).first()

        const rows = optionIds.map(optionId => ({ userId, questionId: firstOption.questionId, optionId }))
        await knex.batchInsert('QuestionResponseChoice', rows, 30)
        return true
      },

    },

    QuestionnaireAssignment: {

      create: async (questionnaireId: number, assigneeId: number, assignerId: number) => {
        await knex('QuestionnaireAssignment').insert({ questionnaireId, assigneeId, assignerId })
        return true
      },

      delete: async (questionnaireId: number, assigneeId: number, assignerId: number) => {
        await knex('QuestionnaireAssignment').where({ questionnaireId, assigneeId, assignerId }).delete()
        return true
      },

      findByAssignerId: async (assignerId: number) => {
        const assignments = await knex<{}, T.QuestionnaireAssignment[]>('QuestionnaireAssignment').where({ assignerId }).select()
        return Promise.all(assignments.map(async assignment => {
          assignment.questionnaire = await db.Questionnaire.findById(assignment.questionnaireId)
          assignment.assignee = await db.User.findById(assignment.assigneeId)
          return assignment
        }))
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
            await knex('QuestionOption').insert({ questionId, text: o.text })
          })

          return Object.assign({ id: questionId }, q)
        }))
      },

      update: async (question: T.Question) => {
        if (!question.id) throw new Error('Must supply at minimum an id to update a question.')

        const { id, text } = question

        await knex('Question').where({ id: question.id }).update({ id, text })

        await Promise.all(question.options?.map(async o => {
          if (o.id) await knex('QuestionOption').where({ id: o.id }).update({ text: o.text })
          else await knex('QuestionOption').insert({ questionId: question.id, text: o.text })
        }))

        return db.Question.findById(question.id)
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
            if (booleanResponse !== undefined && booleanResponse !== null) // ensure we don't accidentally make no response a false response
              q.response = !!booleanResponse?.value // MySQL stores bool as binary
          } else if (q.type === 'TEXT') {
            const textResponse = await knex<{}, T.DBQuestionResponseText>('QuestionResponseText').where({ questionId, userId }).first()
            q.response = textResponse?.value
          } else if (q.type === 'SINGLE_CHOICE') {
            const choiceResponse = await knex<{}, T.DBQuestionResponseChoice>('QuestionResponseChoice').where({ questionId, userId }).first()
            const choiceOption = q.options.find(o => o.id === choiceResponse?.optionId)
            q.response = choiceOption
          } else if (q.type === 'MULTIPLE_CHOICE') {
            const choiceResponses = await knex<{}, T.DBQuestionResponseChoice[]>('QuestionResponseChoice').where({ questionId, userId })
            const choiceOptions = choiceResponses.map(response => q.options.find(option => option.id === response.optionId))
            q.response = choiceOptions
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
      // Since this function is called lots in the test suite, we want it to be fast.
      // Originally we just migrated down and up each time, but that took an increasingly
      // long time to do. This is much faster, but involves keeping track of each table.
      // Ideally we have a way to clear the db real fast, but not have to list each table
      // here.
      clearDb: async () => {
        for (let table of [ // Must be in order to prevent foreign key errors
          'QuestionnaireAssignment',
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
  return knex('User')
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

// TODO Test some ops given then no options given
// A few endpoints related to saving answers to questions can take multiple responses
// (options). This function both ensures all options given are for the questionId given.
const ensureOptionsAreForSingleQuestion = async (knex, questionId: number, optionIds: number[]) => {
  if (optionIds.length === 0) return

  const questionMarks     = optionIds.map(v => '?').join(',')
  const questionIdObjects = await knex.raw(`SELECT questionId FROM QuestionOption WHERE id IN (${questionMarks})`, optionIds)
  const questionIds       = questionIdObjects[0].map(o => o.questionId)
  const questionIdSingle  = _.uniq(questionIds)

  if (questionIdSingle.length !== 1) throw new Error('All options must be for only a single question.')
  if (questionIdSingle[0] !== questionId) throw new Error('The options given are not for the questionId supplied.')
}

export default Db
