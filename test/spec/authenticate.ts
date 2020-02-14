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

const DEAUTH = gql`
  mutation {
    deauthenticate
  }
`

export default function(test, knex, db, server) {
  test('GQL Create User -> Auth -> Me -> Deauth', async t => {
    await db._util.resetDB()

    const signedOutClient = createTestClient(server)

    const email = 'test@email.com'
    const password = 'testPass'

    const createResp = await signedOutClient.mutate({ mutation: CREATE_USER, variables: { email, password }})
    const user = createResp?.data?.createUser

    t.deepEqual(user, { email, id: 1 })

    const authResp = await signedOutClient.mutate({ mutation: AUTHENTICATE, variables: { email, password }})
    const token = authResp?.data?.authenticate

    t.assert(!!token, 'Should have received a token, but instead got: ' + token)

    const signedInClient = createTestClient(server, { authorization: token })

    const meResp = await signedInClient.query({ query: ME })
    t.equal(email, meResp?.data?.me?.email, 'After creating then authenticating a user, a request for "me" did not work.')

    const deauthResp = await signedInClient.mutate({ mutation: DEAUTH })
    t.equal(true, deauthResp?.data?.deauthenticate)

    t.end()
  })
}

