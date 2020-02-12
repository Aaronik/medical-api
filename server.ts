import { ApolloServer } from 'apollo-server'
import typeDefs from 'src/schema'
import db from 'src/db'

const server = new ApolloServer({
  typeDefs,
  context: (obj) => {

  },
  resolvers: {
    Query: {
      test: async (parent, args, context, info) => {
        const tables = (await db.Test.listTables())[0].map(p => p.Tables_in_milli_db)
        return { tables }
      },
      user: (parent, args, context, info) => {
        console.log('user, db:', db)
      }
    }
  }
})

server.listen(process.env.PORT).then(({ url }) => {
  console.log(`🚀 GQL server ready at ${url}`)
})
