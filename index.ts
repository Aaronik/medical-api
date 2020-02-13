import Db from 'src/db'
import Knex from 'knex'
import Server from 'src/server'

// TODO Alright, we could also use a more complex knexfile.ts that has multiple
// NODE_ENV entries and then set that NODE_ENV thing for testing / production, etc.
const knex = Knex({
  client: 'mysql',
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DB,
  }
})

const server = Server(knex)

server.listen(process.env.PORT).then(({ url }) => {
  console.log(`🚀 GQL server ready at ${url}`)
})
