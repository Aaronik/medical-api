import { ApolloServerExpressConfig, CorsOptions } from 'apollo-server-express'
import typeDefs from 'src/schema'
import { Request } from 'express'
import Db from 'src/db'

// Sigh, this is just how Apollo structures it. It'd be great if they'd export this type
// but they inline it.
type ApolloOptions = ApolloServerExpressConfig & {
  cors?: CorsOptions | boolean;
  onHealthCheck?: (req: Request) => Promise<any>;
}

// Abstracted so we can inject db into it. This is so we can run tests and our dev/prod server
// against different databases.
//
// Just call it by passing in db. See server.ts
export default function apolloOptions(db: ReturnType<typeof Db>): ApolloOptions {
  return {
    typeDefs,
    context: (obj) => {

    },
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
          const user = await db.User.create({ email, password })
          console.log('created User:', user)
          return user
        }
      }
    }
  }
}