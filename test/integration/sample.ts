import test from 'tape'
import { gql } from 'apollo-server'
import Knex from 'knex'
import Db from 'src/db'
import apolloOptions from 'src/apollo-options'
import { ApolloServer } from 'apollo-server'
import { createTestClient } from 'apollo-server-testing'
import fs from 'fs'
import summarize from 'tap-summary'

// TODO Getting issues...
// fs.createReadStream('test.tap')
//   .pipe(summarize({
//     ansi: true,
//     progress: true,
//   }))
//   .pipe(process.stdout)

// mysql -u root -psecret -P 3307 -h 127.0.0.1 -D milli_db_test does work
const knex = Knex({
  client: 'mysql',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    password: 'secret',
    database: 'milli_db_test',
    port: 3307
  }
})

const db = Db(knex)
// const server = new ApolloServer(apolloOptions(db))

// const CREATE_USER = gql`
//   mutation CreateUser($email: String, $password: String){
//     createUser(email: $email, password: $password) {
//       id
//       email
//     }
//   }
// `

test('gql test', t => {
  // await db._util.resetDB()

  knex.raw('show tables;').then(() => t.end())
  // console.log(tabs)

  // const { mutate } = createTestClient(server)

  // const email = 'test@email.com'
  // const password = 'testPass'

  // const user = await mutate({ mutation: CREATE_USER, variables: { email, password }})

  // t.deepEqual(user, { email, id: 1 })

  // t.end()
})
