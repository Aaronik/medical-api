import { ApolloServerExpressConfig, CorsOptions } from 'apollo-server-express'
import { ApolloServer, AuthenticationError, UserInputError, ForbiddenError, ValidationError } from 'apollo-server'
import typeDefs from 'src/schema'
import { Request } from 'express'
import Db from 'src/db'
import Knex from 'knex'
import * as T from 'src/types.d'
import { sleep } from 'src/util'

// Abstracted so we can inject our db conection into it. This is so we can run tests and our dev/prod server
// against different databases.
//
// Just call it by passing in an already connected knex object.
export default function Server(knex: Knex) {
  const db = Db(knex)

  const apolloOptions: ApolloOptions = {
    typeDefs,

    context: async (ctx) => {
      // await sleep(500)

      const token = ctx.req.headers?.authorization
      if (!token) return {}

      const user = await db.User.findByAuthToken(token)

      if (user) {
        await db.User.recordVisit(user.id)
        // Use JS to assign lastVisit instead of hitting DB again (must be performant as this is on every request)
        // One caveat here is that MySQL logs time in seconds, JS is in milliseconds. So the timestamp of your current
        // session will always be more precise than the timestamp of an admin seeing your last visit.
        user.lastVisit = (new Date()).valueOf()
      }

      return { user, token }
    },

    resolvers: {

      Query: {

        user: async (parent, args, context, info) => {
          // SECURITY user should only be able to get themselves, their patients or their doctors,
          // unless they're admin.
          return db.User.findById(args.id)
        },

        users: async (parent, args, context, info) => {
          enforceRoles(context.user, 'ADMIN')
          return await db.User.findAll()
        },

        me: async (parent, args, context, info) => {
          if (context.user) return context.user
          throw new AuthenticationError('No user is currently authenticated.')
        },

        patients: async (parent, args, context, info) => {
          enforceRoles(context.user, 'DOCTOR')
          return db.User.findPatientsByDoctorId(context.user.id)
        },

        doctors: async (parent, args, context, info) => {
          enforceRoles(context.user, 'PATIENT')
          return db.User.findDoctorsForPatientId(context.user.id)
        },

        allQuestionnaires: async (parent, args, context, info) => {
          enforceRoles(context.user, 'ADMIN')
          return db.Questionnaire.all(context.user?.id)
        },

        questionnaire: async (parent, args, context, info) => {
          // SECURITY need to make sure that only an admin, the doctor who created the questionnaire,
          // or a patient to whom the questionnaire is assigned, can call this
          const { id } = enforceArgs(args, 'id')
          return db.Questionnaire.findById(id, context.user?.id)
        },

        questionnairesAssignedToMe: async (parent, args, context, info) => {
          enforceRoles(context.user)
          return db.Questionnaire.findAssignedToUser(context.user.id)
        },

        questionnairesIMade: async (parent, args, context, info) => {
          enforceRoles(context.user, 'DOCTOR', 'ADMIN')
          return db.Questionnaire.findMadeByUser(context.user.id)
        },

        questionnaireAssignmentsIMade: async (parent, args, context, info) => {
          enforceRoles(context.user, 'DOCTOR', 'ADMIN')
          return db.QuestionnaireAssignment.findByAssignerId(context.user.id)
        },

        patientQuestionnaireResponses: async (parent, args, context, info) => {
          enforceRoles(context.user, 'DOCTOR', 'ADMIN')
          const { patientId } = enforceArgs(args, 'patientId')

          // ensure doctor is doctor of patient
          const doctorsPatients = await db.User.findPatientsByDoctorId(context.user.id)
          if (!doctorsPatients.map(p => p.id).includes(patientId)) throw new ForbiddenError('Must request for your own patient')

          return db.Questionnaire.findAssignedToUser(patientId)
        },

        question: async (parent, args, context, info) => {
          // SECURITY Admin, doctor who made it or patient to whom it's assigned
          const { id } = enforceArgs(args, 'id')
          return db.Question.findById(id, context.user?.id)
        },

        timelineItems: async (parent, args, context, info) => {
          const { userId } = enforceArgs(args, 'userId')
          // TODO ensure only the requesting user or their doctor can see these
          return db.Timeline.itemsByUserId(userId)
        },

        timelineItem: async (parent, args, context, info) => {
          const { id } = enforceArgs(args, 'id')
          return db.Timeline.findItemById(id)
        },

        timelineGroups: async (parent, args, context, info) => {
          return db.Timeline.groups()
        },


        timelineGroup: async (parent, args, context, info) => {
          const { id } = enforceArgs(args, 'id')
          return db.Timeline.findGroupById(id)
        },


      },

      Mutation: {

        createUser: async (parent, args, context, info) => {
          const { email, password, role, name } = enforceArgs(args, 'email', 'password', 'role', 'name')
          const existingUser = await db.User.findByEmail(email)
          if (existingUser) throw new ValidationError(`A user with the email ${email} already exists!`)
          return db.User.create(email, password, role, name)
        },

        updateMe: async (parent, args, context, info) => {
          const { user }: { user: Partial<T.MeUserInput> } = enforceArgs(args, 'user')
          if (!context.user) throw new ForbiddenError('Must be authenticated to update user.')
          if (user.role) throw new ForbiddenError('Cannot update role.')

          // users must be able to delete their images
          const newImageUrl = user.imageUrl === ""
            ? user.imageUrl
            : user.imageUrl
              ? user.imageUrl
              : context.user.imageUrl || null

          const update = {
            id: context.user.id,
            role: context.user.role, // Note that we do not allow users to change their role
            email: user.email || context.user.email || null,
            name: user.name || context.user.name || null,
            imageUrl: newImageUrl,
            birthday: user.birthday || context.user.birthday || null
          }

          return db.User.update(update)
        },

        authenticate: async (parent, args, context, info) => {
          const { email, password } = enforceArgs(args, 'email', 'password')
          return db.Auth.authenticate(email, password)
        },

        deauthenticate: async (parent, args, context, info) => {
          return db.Auth.deauthenticate(context.token)
        },

        assignPatientToDoctor: async (parent, args, context, info) => {
          // SECURITY Patient basically has to come into system through the doctor, can't just
          // sign up through <Signup/>. Otherwise all docs would have to be able to see all
          // patients? Orrrrrrr, patient could sign up, theeeen through an email thing,
          // a doc could invite a patient to be theirs. So basically this might happen outside
          // of this endpoint. But it should probs still exist for admins?
          enforceRoles(context.user, 'ADMIN')
          const { doctorId, patientId } = enforceArgs(args, 'patientId', 'doctorId')
          return db.DoctorPatientAssociation.create(doctorId, patientId)
        },

        unassignPatientFromDoctor: async (parent, args, context, info) => {
          const { doctorId, patientId } = enforceArgs(args, 'patientId', 'doctorId')
          return db.DoctorPatientAssociation.destroy(doctorId, patientId)
        },

        createTimelineItem: async (parent, args, context, info) => {
          enforceRoles(context.user)
          const { item } = enforceArgs(args, 'item')
          return db.Timeline.createItem(context.user.id, item)
        },

        updateTimelineItem: async (parent, args, context, info) => {
          enforceRoles(context.user)
          const { item } = enforceArgs(args, 'item')
          enforceArgs(item, 'id')
          return db.Timeline.updateItem(item)
        },

        createTimelineGroup: async (parent, args, context, info) => {
          enforceRoles(context.user)
          const { group } = enforceArgs(args, 'group')
          return db.Timeline.createGroup(group)
        },

        updateTimelineGroup: async (parent, args, context, info) => {
          enforceRoles(context.user)
          const { group } = enforceArgs(args, 'group')
          enforceArgs(group, 'id')
          return db.Timeline.updateGroup(group)
        },

        createQuestionnaire: async (parent, args, context, info) => {
          enforceRoles(context.user, 'DOCTOR', 'ADMIN')
          const { title, questions }: { title: string, questions: T.Question[] } = enforceArgs(args, 'title', 'questions')
          return db.Questionnaire.create({ title, questions }, context.user.id)
        },

        updateQuestionnaire: async (parent, args, context, info) => {
          enforceRoles(context.user, 'DOCTOR', 'ADMIN')
          const { id, title, questions } = enforceArgs(args, 'id')
          return db.Questionnaire.update({ id, title, questions })
        },

        deleteQuestionnaire: async (parent, args, context, info) => {
          const { id } = enforceArgs(args, 'id')
          return db.Questionnaire.delete(id)
        },

        createQuestionnaireAssignment: async (parent, args, context, info) => {
          enforceRoles(context.user, 'DOCTOR')
          const { assignment } = enforceArgs(args, 'assignment')

          // Enforce patients belonging to doctor
          const patients = await db.User.findPatientsByDoctorId(context.user.id)
          if (!patients.some(patient => patient.id === assignment.assigneeId)) throw new ForbiddenError('Cannot assign questionnaires to users other than your patients.')
          assignment.assignerId = context.user.id

          return db.QuestionnaireAssignment.create(assignment)
        },

        updateQuestionnaireAssignment: async (parent, args, context, info) => {
          enforceRoles(context.user, 'DOCTOR')
          const { assignment } = enforceArgs(args, 'assignment')

          // Enforce patients belonging to doctor, but only if the assignment is being redirected
          if (assignment.assigneeId) {
            const patients = await db.User.findPatientsByDoctorId(context.user.id)
            if (!patients.some(patient => patient.id === assignment.assigneeId)) throw new ForbiddenError('Cannot assign questionnaires to users other than your patients.')
            assignment.assignerId = context.user.id
          }

          // Enforce assignment having been created by doctor
          const dbAssignment = await db.QuestionnaireAssignment.findById(assignment.id)
          if (dbAssignment.assignerId !== context.user.id) throw new ForbiddenError('Cannot update someone elses assignment.')

          return db.QuestionnaireAssignment.update(assignment)
        },

        deleteQuestionnaireAssignment: async (parent, args, context, info) => {
          enforceRoles(context.user, 'DOCTOR', 'ADMIN')
          const { id } = enforceArgs(args, 'id')
          const questionnaireAssignment = await db.QuestionnaireAssignment.findById(id)
          if (questionnaireAssignment.assignerId !== context.user.id) throw new ForbiddenError('Must own assignment to delete it.')
          return db.QuestionnaireAssignment.delete(id)
        },

        addQuestions: async (parent, { questions }, context, info) => {
          questions.forEach(q => enforceArgs(q, 'text', 'type', 'questionnaireId'))
          return db.Question.create(questions)
        },

        deleteQuestion: async (parent, args, context, info) => {
          const { id } = enforceArgs(args, 'id')
          return db.Question.delete(id)
        },

        updateQuestion: async (parent, args, context, info) => {
          const { question } = enforceArgs(args, 'question')
          return db.Question.update(question)
        },

        createQuestionRelations: async (parent, { relations }, context, info) => {
          return db.QuestionRelation.create(relations)
        },

        submitBooleanQuestionResponse: async (parent, args, context, info) => {
          enforceRoles(context.user)
          const { questionId, assignmentInstanceId, value } = enforceArgs(args, 'questionId', 'assignmentInstanceId', 'value')
          return db.QuestionResponse.submitForBoolean(context.user.id, questionId, assignmentInstanceId, value)
        },

        submitTextQuestionResponse: async (parent, args, context, info) => {
          enforceRoles(context.user)
          const { questionId, assignmentInstanceId, value } = enforceArgs(args, 'questionId', 'assignmentInstanceId', 'value')
          return db.QuestionResponse.submitForText(context.user.id, questionId, assignmentInstanceId, value)
        },

        submitChoiceQuestionResponse: async (parent, args, context, info) => {
          enforceRoles(context.user)
          const { questionId, assignmentInstanceId, optionId } = enforceArgs(args, 'optionId', 'assignmentInstanceId', 'questionId')
          return db.QuestionResponse.submitForChoice(context.user.id, questionId, assignmentInstanceId, optionId)
        },

        submitChoiceQuestionResponses: async (parent, args, context, info) => {
          enforceRoles(context.user)
          const { optionIds, assignmentInstanceId, questionId } = enforceArgs(args, 'optionIds', 'assignmentInstanceId', 'questionId')
          return db.QuestionResponse.submitMultipleForChoice(context.user.id, questionId, assignmentInstanceId, optionIds)
        },

        submitEventQuestionResponse: async (parent, args, context, info) => {
          enforceRoles(context.user)
          const { questionId, assignmentInstanceId, event } = args
          return db.QuestionResponse.submitForEvent(context.user.id, questionId, assignmentInstanceId, event)
        },

      },

      QuestionMeta: {
        __resolveType: (meta: T.QuestionMeta) => {
          return meta.type
        }
      },

      Question: {
        __resolveType: (obj: T.Question) => {
          switch (obj.type) {
            case 'BOOLEAN': return 'BooleanQuestion'
            case 'TEXT': return 'TextQuestion'
            case 'SINGLE_CHOICE': return 'SingleChoiceQuestion'
            case 'MULTIPLE_CHOICE': return 'MultipleChoiceQuestion'
            case 'EVENT': return 'EventQuestion'
          }
        }
      },

    },
  }

  return new ApolloServer(apolloOptions)

}

// Sigh, this is just how Apollo structures it. It'd be great if they'd export this type
// but they inline it.
type ApolloOptions = ApolloServerExpressConfig & {
  cors?: CorsOptions | boolean;
  onHealthCheck?: (req: Request) => Promise<any>;
}

// Helper to streamline the enforcement / destructuring of GQL argument
// TODO It'd be rad if the output type of this actually utilized the fields given
// so as to prevent something like const { id } = enforceArgs(args, 'field', 'gnoll', 'grassland')
// (id not being on the list of permitted arguments, so not destructurable)
const enforceArgs = <_, T>(args: any, ...fields: string[]) => {
  const missingFields = []

  fields.forEach(field => {
    if (!args.hasOwnProperty(field)) missingFields.push(field)
  })

  if (missingFields.length) throw new UserInputError(`You must provide the following fields: ${missingFields.join(', ')}`)

  return args
}

// Helper to ensure user has sufficient permissions. Pass in however many roles,
// and the helper will throw if the user doesn't satisfy any of those roles. Will
// always fail if no user was passed in.
export const enforceRoles = (user?: T.User, ...roles: T.Role[]) => {
  if (roles.length === 0 && user) return
  if (!user || !roles.includes(user.role)) throw new ForbiddenError('Insufficient permissions.')
}

