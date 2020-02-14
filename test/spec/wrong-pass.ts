import { gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'

const CREATE_USER = gql`
  mutation ($email: String, $password: String){
    createUser(email: $email, password: $password) {
      id
      email
    }
  }
`

const AUTHENTICATE = gql`
  mutation ($email: String, $password: String) {
    authenticate(email: $email, password: $password)
  }
`

export default function(test, knex, db, server) {
  test('GQL Create User -> Auth with Wrong Creds', async t => {
    await db._util.resetDB()

    const { query, mutate } = createTestClient(server)

    const email = 'test@email.com'
    const password = 'testPass'

    const createResp = await mutate({ mutation: CREATE_USER, variables: { email, password }})
    const user = createResp?.data?.createUser

    t.deepEqual(user, { email, id: 1 })

    const wrongPass = 'wrongPass'

    const authResp = await mutate({ mutation: AUTHENTICATE, variables: { email, password: wrongPass }})
    const errorMessage = authResp.errors[0].message

    t.assert(errorMessage.toLowerCase().includes('incorrect'))

    t.end()
  })
}

