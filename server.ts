import { ApolloServer } from 'apollo-server'
import typeDefs from 'src/schema'
import db from 'src/db'

const server = new ApolloServer({
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
    }
  }
})

server.listen(process.env.PORT).then(({ url }) => {
  console.log(`🚀 GQL server ready at ${url}`)
})
