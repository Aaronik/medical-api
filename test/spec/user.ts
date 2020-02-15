import { gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { TestModuleExport } from 'test/runner'

const CREATE_USER = gql`
  mutation ($email: String, $password: String, $role: Role) {
    createUser(email: $email, password: $password, role: $role) {
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

export const test: TestModuleExport = (test, mutate, query, knex, db, server) => {

  test('GQL Create User -> Auth -> Me -> Deauth', async t => {
    await db._util.resetDB()

    // The rest use mutate/query supplied, but this test will go deeper and be able to forwarn of any
    // issues signing in better than mutate/query since they don't do t.asserts or whatevs
    const signedOutClient = createTestClient(server)

    const email = 'test@email.com'
    const password = 'testPass'

    const createResp = await signedOutClient.mutate({ mutation: CREATE_USER, variables: { email, password, role: 'ADMIN' }})
    const user = createResp?.data?.createUser

    t.deepEqual(user, { email, id: 1 })

    const authResp = await signedOutClient.mutate({ mutation: AUTHENTICATE, variables: { email, password, role: 'ADMIN' }})
    const token = authResp?.data?.authenticate

    t.assert(!!token, 'Should have received a token, but instead got: ' + token)

    const signedInClient = createTestClient(server, { authorization: token })

    const meResp = await signedInClient.query({ query: ME })
    t.equal(email, meResp?.data?.me?.email, 'After creating then authenticating a user, a request for "me" did not work.')

    const deauthResp = await signedInClient.mutate({ mutation: DEAUTH })
    t.equal(true, deauthResp?.data?.deauthenticate)

    t.end()
  })

  test('GQL Create User -> Create User -> Get Users', async t => {
    await db._util.resetDB()

    const email1 = 'test@email.com'
    const email2 = 'test2@email.com'
    const password = 'testPass'

    const resp1 = await mutate(server).asUnprived({ mutation: CREATE_USER, variables: { email: email1, password, role: 'ADMIN' }})
    const resp2 = await mutate(server).asUnprived({ mutation: CREATE_USER, variables: { email: email2, password, role: 'ADMIN' }})

    t.equal(resp1.data?.createUser?.email, email1)
    t.equal(resp2.data?.createUser?.email, email2)

    const { data } = await mutate(server).asUnprived({ mutation: GET_USERS })

    t.deepEqual(data?.users, [{ email: email1 }, { email: email2 }])

    t.end()
  })

  test('GQL Create User -> Create Duplicate User', async t => {
    await db._util.resetDB()

    const email = 'test@email.com'
    const password = 'testPass'

    const { data } = await mutate(server).asUnprived({ mutation: CREATE_USER, variables: { email, password, role: 'ADMIN' }})
    const user = data?.createUser

    t.equal(user?.email, email)

    const { errors } = await mutate(server).asUnprived({ mutation: CREATE_USER, variables: { email, password, role: 'ADMIN' }})
    const message = errors[0]?.message
    t.assert(message.includes('already exists'))

    t.end()
  })


}


