import { gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'

const CREATE_USER = gql`
  mutation ($email: String, $password: String) {
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

const ME = gql`
  query {
    me{
      email
    }
  }
`

export default function(test, knex, db, server) {
  test('Authenticating via GQL', async t => {
    await db._util.resetDB()

    const { mutate, query } = createTestClient(server)

    const email = 'test@email.com'
    const password = 'testPass'

    const createResp = await mutate({ mutation: CREATE_USER, variables: { email, password }})
    const user = createResp.data.createUser

    t.deepEqual(user, { email, id: 1 })

    const authResp = await mutate({ mutation: AUTHENTICATE, variables: { email, password }})
    const token = authResp.data.authenticate

    t.assert(!!token, 'Should have received a token, but instead got: ' + token)

    const meResp = await (createTestClient(server, { authorization: token })).query({ query: ME })
    t.equal(email, meResp.data.me.email, 'After creating then authenticating a user, a request for "me" did not work.')

    t.end()
  })
}

