import Db from 'src/db'
import Knex from 'knex'
import Server from 'src/server'
import { sleep } from 'src/util'

const knex = Knex(require('./knexfile'))

const server = Server(knex)

setInterval(Db(knex)._util.createQuestionnaireAssignmentInstances, 60 * 1000)

server.listen(process.env.PORT).then(({ url }) => {
  console.log(`🚀 GQL server ready at ${url}`)
})
