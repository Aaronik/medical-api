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
        return knex.raw('UPDATE UserLogin SET lastVisit = NOW() WHERE userId = ?', [userId])
      },

    },

    Questionnaire: {

      // If the userId and assignmentInstanceId are supplied, we'll try to dig up the user's responses as well.
      findById: async (id: number, userId?: number, assignmentInstanceId?: number): Promise<T.Questionnaire | null> => {
        const questionnaire = await knex<{}, T.Questionnaire>('Questionnaire').where({ id }).first()
        if (!questionnaire) return null
        questionnaire.questions = await db.Question.findByQuestionnaireId(questionnaire.id, userId, assignmentInstanceId)
        questionnaire.assignmentInstanceId = assignmentInstanceId
        return questionnaire
      },

      findAssignedToUser: async (userId: number) => {
        const assignmentInstances = await knex('QuestionnaireAssignmentInstance').where({ assigneeId: userId })

        return Promise.all(assignmentInstances.map(assignmentInstance => {
          return db.Questionnaire.findById(assignmentInstance.questionnaireId, userId, assignmentInstance.id)
        }))
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
          // TODO woah, use db.Question.create here
          const [questionId] = await knex('Question').insert({ type: q.type, text: q.text, questionnaireId })

          if (!canHaveOptions(q)) return

          await Promise.all(q.options.map(async o => {
            return knex('QuestionOption').insert({ questionId, text: o.text })
          }))
        }))

        return db.Questionnaire.findById(questionnaireId)
      },

      update: async ({ id, title, questions }: { id: number, title?: string, questions?: T.Question[]}) => {
        if (title) await knex('Questionnaire').where({ id }).update({ title })
        if (questions) await Promise.all(questions.map(async q => await db.Question.update(q)))
        return db.Questionnaire.findById(id)
      },

      delete: async (id: number) => {
        return knex('Questionnaire').where({ id }).delete()
      },

      createQuestionRelations: async (relations: T.QuestionRelation[]) => {
        await Promise.all(relations.map(async relation => {
          await knex('QuestionRelation').insert(relation)
        }))
      },

      submitBooleanQuestionResponse: async (userId: string, questionId: number, assignmentInstanceId: number, value: boolean) => {
        try {
          await knex('QuestionResponseBoolean').insert({ userId, questionId, assignmentInstanceId, value })
          return true
        } catch (e) {
          await knex('QuestionResponseBoolean').where({ userId, questionId, assignmentInstanceId }).update({ value })
          return true
        }
      },

      submitTextQuestionResponse: async (userId: string, questionId: number, assignmentInstanceId: number, value: string) => {
        try {
          await knex('QuestionResponseText').insert({ userId, questionId, assignmentInstanceId, value })
          return true
        } catch (e) {
          await knex('QuestionResponseText').where({ userId, questionId, assignmentInstanceId }).update({ value })
          return true
        }
      },

      submitChoiceQuestionResponse: async (userId: string, questionId: number, assignmentInstanceId: number, optionId: number) => {
        const option = await knex<{}, T.QuestionOption>('QuestionOption').where({ id: optionId }).first()

        // we remove all the existing responses for this question
        await knex('QuestionResponseChoice').where({ userId, questionId: option.questionId, assignmentInstanceId }).delete()

        await knex('QuestionResponseChoice').insert({ userId, questionId: option.questionId, assignmentInstanceId, optionId })
        return true
      },

      submitChoiceQuestionResponses: async (userId: string, questionId: number, assignmentInstanceId: number, optionIds: number[]) => {
        await ensureOptionsAreForSingleQuestion(knex, questionId, optionIds)

        // we remove all the existing responses for this question
        await knex('QuestionResponseChoice').where({ userId, questionId, assignmentInstanceId }).delete()

        // If the user wants to remove all their options, we're done
        if (optionIds.length === 0) return true

        // Find out what question these are for. They all have to be for the same question, so we'll check the first
        // and assume it's the same with the rest. If not, the DB will throw.
        const firstOption = await knex('QuestionOption').where({ id: optionIds[0] }).first()

        const rows = optionIds.map(optionId => ({ userId, questionId: firstOption.questionId, assignmentInstanceId, optionId }))
        await knex.batchInsert('QuestionResponseChoice', rows, 30)
        return true
      },

      submitEventQuestionResponse: async (userId: number, questionId: number, assignmentInstanceId: number, event: T.QuestionEventInput) => {
        const oldTimelineItemIdObject = await knex('QuestionResponseEvent').where({ userId, questionId, assignmentInstanceId }).select('timelineItemId').first()

        if (oldTimelineItemIdObject) { // if this is true, this question is being updated
          // Nuke the old timeline item formerly answered by this event question
          await db.Timeline.deleteItem(oldTimelineItemIdObject.timelineItemId)

          // Nuke the existing response
          await knex('QuestionResponseEvent').where({ userId, questionId, assignmentInstanceId }).delete()
        }

        const { title, details, start, end } = event

        const { id: timelineItemId } = await db.Timeline.createItem(userId, { content: details, title, start, end })
        await knex('QuestionResponseEvent').insert({ userId, questionId, assignmentInstanceId, timelineItemId })
      },

    },

    QuestionnaireAssignment: {

      create: async (assignment: T.QuestionnaireAssignment) => {
        const { questionnaireId, assigneeId, assignerId, repeatInterval } = assignment
        const [assignmentId] = await knex('QuestionnaireAssignment').insert({ questionnaireId, assigneeId, assignerId, repeatInterval })
        await db.QuestionnaireAssignmentInstance.create({ questionnaireId, assigneeId, assignerId, assignmentId })
        return knex('QuestionnaireAssignment').where({ id: assignmentId }).first()
      },

      update: async (assignment: T.QuestionnaireAssignment) => {
        const { id } = assignment
        await knex('QuestionnaireAssignment').where({ id }).update(assignment)
        return knex('QuestionnaireAssignment').where({ id }).first()
      },

      delete: async (id: number) => {
        await knex('QuestionnaireAssignment').where({ id }).delete()
        return true
      },

      findById: async (id: number): Promise<T.QuestionnaireAssignment> => {
        const assignment = await knex('QuestionnaireAssignment').where({ id }).select().first()
        assignment.questionnaire = await db.Questionnaire.findById(assignment.questionnaireId)
        assignment.assignee = await db.User.findById(assignment.assigneeId)
        return assignment
      },

      findByAssignerId: async (assignerId: number) => {
        const assignmentIdsObject = await knex<{}, T.QuestionnaireAssignment[]>('QuestionnaireAssignment').where({ assignerId }).select('id')
        const assignmentIds = assignmentIdsObject.map(o => o.id)
        return Promise.all(assignmentIds.map(db.QuestionnaireAssignment.findById))
      },

    },

    QuestionnaireAssignmentInstance: {

      create: async (assignmentInstance: T.PreDBQuestionnaireAssignmentInstance) => {
        const { questionnaireId, assigneeId, assignerId, assignmentId } = assignmentInstance
        await knex('QuestionnaireAssignmentInstance').insert({ questionnaireId, assigneeId, assignerId, assignmentId })
      }
    },

    Question: {

      findById: async (id: number, userId?: number, assignmentInstanceId?: number) => {
        const questions = await db.Question._findWhere({ id }, userId, assignmentInstanceId)
        if (!questions) return undefined
        return questions[0]
      },

      findByQuestionnaireId: async (id: number, userId?: number, assignmentInstanceId?: number) => {
        return db.Question._findWhere({ questionnaireId: id }, userId, assignmentInstanceId)
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

        // TODO right now updating a question will delete a user's responses to that question, given the question has options.
        // This was originally a bug, but after consideration it appears to be a feature. Don't want doctors making patients look
        // bad.
        if (question.options) {
          // First remove all existing options, then add these all back.
          await knex('QuestionOption').where({ questionId: question.id }).delete()
          const rows = question.options.map(option => ({ questionId: question.id, text: option.text, id: option.id }))
          await knex.batchInsert('QuestionOption', rows, 30)
        }

        return db.Question.findById(question.id)
      },

      delete: async (id: number) => {
        return knex('Question').where({ id }).delete()
      },

      _findWhere: async (where: Partial<T.Question>, userId?: number, assignmentInstanceId?: number): Promise<T.Question[]> => {
        let questions = await knex<{}, T.Question[]>('Question').where(where)

        await Promise.all(questions.map(async q => {
          // Grab each question relation and assign to question
          q.next = await knex<{}, T.QuestionRelation[]>('QuestionRelation').where({ questionId: q.id })

          // If questions can have options, grab em and stick em onto the question
          if (canHaveOptions(q))
            q.options = await knex<{}, T.QuestionOption[]>('QuestionOption').where({ questionId: q.id })
        }))

        if (!userId || !assignmentInstanceId) return questions

        // If there's a user attached, we'll try to dig up their responses as well.
        await Promise.all(questions.map(async q => {
          const questionId = q.id

          if (q.type === 'BOOLEAN') {
            const booleanResponse = await knex<{}, T.DBQuestionResponseBoolean>(
              'QuestionResponseBoolean'
            ).where({ questionId, userId, assignmentInstanceId }).first()
            if (booleanResponse !== undefined && booleanResponse !== null) // ensure we don't accidentally make no response a false response
              q.response = !!booleanResponse?.value // MySQL stores bool as binary
          } else if (q.type === 'TEXT') {
            const textResponse = await knex<{}, T.DBQuestionResponseText>(
              'QuestionResponseText'
            ).where({ questionId, userId, assignmentInstanceId }).first()
            q.response = textResponse?.value
          } else if (q.type === 'SINGLE_CHOICE') {
            const choiceResponse = await knex<{}, T.DBQuestionResponseChoice>(
              'QuestionResponseChoice'
            ).where({ questionId, userId, assignmentInstanceId }).first()
            const choiceOption = q.options.find(o => o.id === choiceResponse?.optionId)
            q.response = choiceOption
          } else if (q.type === 'MULTIPLE_CHOICE') {
            const choiceResponses = await knex<{}, T.DBQuestionResponseChoice[]>(
              'QuestionResponseChoice'
            ).where({ questionId, userId, assignmentInstanceId })
            const choiceOptions = choiceResponses.map(response => q.options.find(option => option.id === response.optionId))
            q.response = choiceOptions
          } else if (q.type === 'EVENT') {
            const response = await knex('QuestionResponseEvent').where({ questionId, userId, assignmentInstanceId }).first()
            if (!response) return
            const timelineItem = await db.Timeline.findItemById(response.timelineItemId)
            q.response = timelineItem
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

      createItem: async (userId: number, item: Omit<T.TimelineItem, 'id'>) => {
        item = sanitizeTimelineItem(item)
        const [id] = await knex('TimelineItem').insert({ userId, ...item })
        return knex('TimelineItem').where({ id }).first()
      },

      updateItem: async (update: Partial<T.TimelineItem>) => {
        update = sanitizeTimelineItem(update)
        await knex('TimelineItem').where({ id: update.id }).update(update)
        return db.Timeline.findItemById(update.id)
      },

      deleteItem: async (id: number) => {
        await knex('TimelineItem').where({ id }).delete()
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
          'QuestionnaireAssignmentInstance','QuestionnaireAssignment',
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
      },

      // Running this will make a single pass through the database and for every
      // QuestionnaireAssignment satisfying the following conditions, it will
      // create a new QuestionnaireAssignmentInstance, which will allow patients
      // to fetch instances of the questionaire they need to fill out, and doctors
      // to see all the different answers their patients have made.
      //
      // Conditions for creation of a new instance:
      // * QuestionaireAssignment must have repeatInterval.
      // * There must not be a QuestionnaireAssignment made within the last repeatInterval minutes.
      createQuestionnaireAssignmentInstances: async () => {
        const questionnaireAssignments = await knex<{}, T.QuestionnaireAssignment[]>('QuestionnaireAssignment').select()

        questionnaireAssignments.forEach(async assignment => {
          if (!assignment.repeatInterval) return // so a 0 value means we won't repeat.

          const instances = await knex<{}, T.QuestionnaireAssignmentInstance[]>(
            'QuestionnaireAssignmentInstance'
          ).where({ assignmentId: assignment.id }).select()

          const needNewInstance = instances.every(instance => {
            const minutesNow = (new Date()).valueOf() / 60000
            const minutesAtCreation = (new Date((instance.created as unknown as number))).valueOf() / 60000
            return minutesNow - minutesAtCreation > assignment.repeatInterval
          })

          if (!needNewInstance) return

          const newInstance: Omit<Omit<T.QuestionnaireAssignmentInstance, 'id'>, 'created'> = {
            assignmentId: assignment.id,
            questionnaireId: assignment.questionnaireId,
            assigneeId: assignment.assigneeId,
            assignerId: assignment.assignerId
          }

          await db.QuestionnaireAssignmentInstance.create(newInstance)
        })
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
