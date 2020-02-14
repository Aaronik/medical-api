import Db from 'src/db'
import Knex from 'knex'
import Server from 'src/server'

const knex = Knex(require('./knexfile'))

const server = Server(knex)

server.listen(process.env.PORT).then(({ url }) => {
  console.log(`🚀 GQL server ready at ${url}`)
})
