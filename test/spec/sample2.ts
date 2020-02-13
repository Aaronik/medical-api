import { gql } from 'apollo-server'
import { createTestClient } from 'apollo-server-testing'

const CREATE_USER = gql`
  mutation CreateUser($email: String, $password: String){
    createUser(email: $email, password: $password) {
      id
      email
    }
  }
`

export default async function(test, knex, db, server) {
  await test('gql test', async t => {
    await db._util.resetDB()

    const { mutate } = createTestClient(server)

    const email = 'test@email.com'
    const password = 'testPass'

    const resp = await mutate({ mutation: CREATE_USER, variables: { email, password }})
    const user = resp.data.createUser

    t.deepEqual(user, { email, id: 1 })

    t.end()
  })

  await test('gql test 1.5', async t => {
    await db._util.resetDB()

    const { mutate } = createTestClient(server)

    const email = 'test@email.com'
    const password = 'testPass'

    const resp = await mutate({ mutation: CREATE_USER, variables: { email, password }})
    const user = resp.data.createUser

    t.deepEqual(user, { email, id: 1 })

    t.end()
  })

  await test('gql test 2', async t => {
    await db._util.resetDB()

    const { mutate } = createTestClient(server)

    const email = 'test@email.com'
    const password = 'testPass'

    const resp = await mutate({ mutation: CREATE_USER, variables: { email, password }})
    const user = resp.data.createUser

    t.deepEqual(user, { email, id: 1 })

    t.end()
  })
}
