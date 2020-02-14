import { ApolloServerExpressConfig, CorsOptions } from 'apollo-server-express'
import { ApolloServer, AuthenticationError, UserInputError, ForbiddenError, ValidationError } from 'apollo-server'
import typeDefs from 'src/schema'
import { Request } from 'express'
import Db from 'src/db'
import Knex from 'knex'

// Sigh, this is just how Apollo structures it. It'd be great if they'd export this type
// but they inline it.
type ApolloOptions = ApolloServerExpressConfig & {
  cors?: CorsOptions | boolean;
  onHealthCheck?: (req: Request) => Promise<any>;
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
      },
      Mutation: {
        createUser: async (parent, args, context, info) => {
          const { email, password } = args
          if (!email || !password) throw new UserInputError(`Must provide valid email and password.`)
          const existingUser = await db.User.findByEmail(email)
          if (existingUser) throw new ValidationError(`A user with the email ${email} already exists!`)
          return db.User.create(email, password)
        },
        authenticate: async (parent, args, context, info) => {
          const { email, password } = args
          if (!email || !password) throw new UserInputError(`Must provide valid email and password.`)
          return db.Auth.authenticate(email, password)
        },
        deauthenticate: async (parent, args, context, info) => {
          return db.Auth.deauthenticate(context.token)
        }
      },
      QuestionMeta: {
        __resolveType: (meta: string) => {
          return meta
        }
      },
      Question: {
        __resolveType: (obj) => {
          return obj.type
        }
      }
    },
  }

  return new ApolloServer(apolloOptions)

}
