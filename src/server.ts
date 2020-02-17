import { ApolloServerExpressConfig, CorsOptions } from 'apollo-server-express'
import { ApolloServer, AuthenticationError, UserInputError, ForbiddenError, ValidationError } from 'apollo-server'
import typeDefs from 'src/schema'
import { Request } from 'express'
import Db from 'src/db'
import Knex from 'knex'
import * as T from 'src/types.d'

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
  fields.forEach(field => {
    if (!args.hasOwnProperty(field)) throw new UserInputError(`You must provide the following fields: ${fields}`)
  })

  return args
}

// Helper to ensure user has sufficient permissions. Pass in however many roles,
// and the helper will throw if the user doesn't satisfy any of those roles. Will
// always fail if no user was passed in.
const enforceRoles = (user?: T.User, ...roles: T.Role[]) => {
  if (!user || !roles.includes(user.role)) throw new ForbiddenError('Insufficient permissions.')
}

// Abstracted so we can inject our db conection into it. This is so we can run tests and our dev/prod server
// against different databases.
//
// Just call it by passing in an already connected knex object.
export default function Server(knex: Knex) {
  const db = Db(knex)

  const apolloOptions: ApolloOptions = {
    typeDefs,

    context: async (ctx) => {
      const token = ctx.req.headers?.authorization
      if (!token) return {}
      const user = await db.User.findByAuthToken(token)
      return { user, token }
    },

    resolvers: {

      Query: {

        user: async (parent, args, context, info) => {
          return db.User.findById(args.id)
        },

        users: async (parent, args, context, info) => {
          return await db.User.findAll()
        },

        me: async (parent, args, context, info) => {
          if (context.user) return context.user
          throw new AuthenticationError('No user is currently authenticated.')
        },

        questionnaire: async (parent, args, context, info) => {
          const { id } = enforceArgs(args, 'id')
          return db.Questionnaire.findById(id)
        },

      },

      Mutation: {

        createUser: async (parent, args, context, info) => {
          const { email, password, role } = enforceArgs(args, 'email', 'password', 'role')
          const existingUser = await db.User.findByEmail(email)
          if (existingUser) throw new ValidationError(`A user with the email ${email} already exists!`)
          return db.User.create(email, password, role)
        },

        updateMe: async (parent, args, context, info) => {
          const { user }: { user: Partial<T.MeUserInput> } = enforceArgs(args, 'user')
          if (!context.user) throw new ForbiddenError('Must be authenticated to update user.')

          const update = {
            id: context.user.id,
            role: user.role || context.user.role || null,
            email: user.email || context.user.email || null,
            name: user.name || context.user.name || null,
            imageUrl: user.imageUrl || context.user.imageUrl || null,
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

        createQuestionnaire: async (parent, args, context, info) => {
          const { title, questions } = enforceArgs(args, 'title', 'questions')

          // Make sure questions are shaped correctly too.
          // TODO Make a type enforcement func? Really the GQL type
          // system should be able to handle it.
          questions.forEach(q => {
            enforceArgs(q, 'type')

            if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE')
              enforceArgs(q, 'options')
          })

          return db.Questionnaire.create({ title, questions })
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
          }
        }
      },

    },
  }

  return new ApolloServer(apolloOptions)

}
