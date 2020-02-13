import { ApolloServerExpressConfig, CorsOptions } from 'apollo-server-express'
import { ApolloServer } from 'apollo-server'
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
    context: (obj) => {},
    resolvers: {
      Query: {
        user: async (parent, args, context, info) => {
          return db.User.findById(args.id)
        },
        users: async (parent, args, context, info) => {
          return await db.User.findAll()
        }
      },
      Mutation: {
        createUser: async (parent, args, context, info) => {
          const { email, password } = args
          return db.User.create({ email, password })
        }
      }
    }
  }

  return new ApolloServer(apolloOptions)
}
