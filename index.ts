import Db from 'src/db'
import Knex from 'knex'
import Server from 'src/server'

const knex = Knex({
  client: 'mysql',
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DB,
    port: Number(process.env.DB_PORT)
  }
})

const server = Server(knex)

server.listen(process.env.PORT).then(({ url }) => {
  console.log(`🚀 GQL server ready at ${url}`)
})
