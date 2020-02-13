import test from 'tape'
import { gql } from 'apollo-server'
import Db from 'src/db'
import apolloOptions from 'src/apollo-options'
import { ApolloServer } from 'apollo-server'
import { createTestClient } from 'apollo-server-testing'
import fs from 'fs'
import summarize from 'tap-summary'
import knex from 'test/db-connection'

// TODO Getting issues...
// fs.createReadStream('test.tap')
//   .pipe(summarize({
//     ansi: true,
//     progress: true,
//   }))
//   .pipe(process.stdout)

const db = Db(knex)

const server = new ApolloServer(apolloOptions(db))

const CREATE_USER = gql`
  mutation CreateUser($email: String, $password: String){
    createUser(email: $email, password: $password) {
      id
      email
    }
  }
`

test('gql test', async t => {
  await db._util.resetDB()

  const { mutate } = createTestClient(server)

  const email = 'test@email.com'
  const password = 'testPass'

  const resp = await mutate({ mutation: CREATE_USER, variables: { email, password }})
  const user = resp.data.createUser

  t.deepEqual(user, { email, id: 1 })

  await knex.destroy()
  t.end()
})
