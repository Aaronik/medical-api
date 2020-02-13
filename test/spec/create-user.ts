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
  await test('Creating Users Via GQL', async t => {
    await db._util.resetDB()

    const { mutate } = createTestClient(server)

    const email = 'test@email.com'
    const password = 'testPass'

    const resp = await mutate({ mutation: CREATE_USER, variables: { email, password }})
    const user = resp.data.createUser

    t.deepEqual(user, { email, id: 1 })

    t.end()
  })

  await test('Expecting Errors Duplicating User Creation', async t => {
    await db._util.resetDB()

    const { mutate } = createTestClient(server)

    const email = 'test@email.com'
    const password = 'testPass'

    const resp = await mutate({ mutation: CREATE_USER, variables: { email, password }})
    const user = resp.data.createUser

    t.equal(user.id, 1)

    const resp2 = await mutate({ mutation: CREATE_USER, variables: { email, password }})
    const message = resp2.errors[0].message
    t.assert(message.includes('already exists'))

    t.end()
  })
}
