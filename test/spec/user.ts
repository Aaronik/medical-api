import { gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { TModuleExport } from 'test/runner'

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


const GET_USERS = gql`
query {
  users {
    email
  }
}
`

export const test: TModuleExport = (test, knex, db, server) => {

  test('trivial', async t => {
    t.assert(true)
    t.end()
  })

  test('GQL Create User -> Create User -> Get Users', async t => {
    await db._util.resetDB()

    const { mutate } = createTestClient(server)

    const email1 = 'test@email.com'
    const email2 = 'test2@email.com'
    const password = 'testPass'

    const createResp1 = await mutate({ mutation: CREATE_USER, variables: { email: email1, password }})
    const createResp2 = await mutate({ mutation: CREATE_USER, variables: { email: email2, password }})

    t.equal(createResp1.data?.createUser?.email, email1)
    t.equal(createResp2.data?.createUser?.email, email2)

    const usersResp = await mutate({ mutation: GET_USERS })

    t.deepEqual(usersResp.data.users, [{ email: email1 }, { email: email2 }])

    t.end()
  })

  test('GQL Create User -> Create Duplicate User', async t => {
    await db._util.resetDB()

    const { mutate } = createTestClient(server)

    const email = 'test@email.com'
    const password = 'testPass'

    const resp = await mutate({ mutation: CREATE_USER, variables: { email, password }})
    const user = resp.data?.createUser

    t.equal(user?.email, email)

    const resp2 = await mutate({ mutation: CREATE_USER, variables: { email, password }})
    const message = resp2.errors[0]?.message
    t.assert(message.includes('already exists'))

    t.end()
  })

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


