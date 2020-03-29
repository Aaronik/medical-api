import { gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { TestModuleExport } from 'test/runner'

const CREATE_USER = gql`
  mutation ($email: String, $password: String, $role: Role, $name: String) {
    createUser(email: $email, password: $password, role: $role, name: $name) {
      id
      email
    }
  }
`

const UPDATE_ME = gql`
  mutation ($user: MeInput) {
    updateMe(user:$user) {
      role
      imageUrl
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
      name
      role
      lastVisit
      joinDate
      imageUrl
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

export const test: TestModuleExport = (test, query, mutate, knex, db, server) => {

  test('GQL Create User -> Auth -> Me -> Deauth', async t => {
    await db._util.clearDb()

    // The rest use mutate/query supplied, but this test will go deeper and be able to forwarn of any
    // issues signing in better than mutate/query since they don't do t.asserts or whatevs
    const signedOutClient = createTestClient(server)

    const email = 'test@email.com'
    const password = 'testPass'
    const name = 'Princess Bubblegum'

    const createResp = await signedOutClient.mutate({ mutation: CREATE_USER, variables: { email, password, role: 'ADMIN', name }})
    const user = createResp?.data?.createUser

    t.equal(user?.email, email)

    const authResp = await signedOutClient.mutate({ mutation: AUTHENTICATE, variables: { email, password }})
    const token = authResp?.data?.authenticate

    t.assert(!!token, 'Should have received a token, but instead got: ' + token)

    const signedInClient = createTestClient(server, { authorization: token })

    const { data: { me }} = await signedInClient.query({ query: ME })
    t.equal(me?.email, email, 'After creating then authenticating a user, a request for "me" did not work.')
    t.equal(me?.name, name, 'Creating a user, name was not created correctly.')

    const deauthResp = await signedInClient.mutate({ mutation: DEAUTH })
    t.equal(true, deauthResp?.data?.deauthenticate)

    t.end()
  })

  test('GQL Create User -> Auth -> 2nd Auth -> Deauth 1', async t => {
    await db._util.clearDb()

    const signedOutClient = createTestClient(server)

    const email = 'test@email.com'
    const password = 'testPass'
    const name = 'Princess Bubblegum'

    await signedOutClient.mutate({ mutation: CREATE_USER, variables: { email, password, role: 'ADMIN', name }})

    const { data: { authenticate: token1 }} = await signedOutClient.mutate({ mutation: AUTHENTICATE, variables: { email, password }})
    const { data: { authenticate: token2 }} = await signedOutClient.mutate({ mutation: AUTHENTICATE, variables: { email, password }})

    t.notEqual(token1, token2,
     `Should have gotten two separate tokens from two separate auth requests.
      This allows for managing logged in state across multiple clients, not
      being logged out of all when you log out of one.`
    )

    const signedInClient1 = createTestClient(server, { authorization: token1 })
    const signedInClient2 = createTestClient(server, { authorization: token2 })

    const deauthResp = await signedInClient1.mutate({ mutation: DEAUTH })
    t.equal(true, deauthResp?.data?.deauthenticate)

    const { data: { me }} = await signedInClient2.query({ query: ME })
    t.equal(me?.email, email)

    const { errors } = await signedInClient1.query({ query: ME })
    t.deepEqual(errors[0].message, 'No user is currently authenticated.')

    t.end()
  })

  test('GQL Create User -> Create User -> Get Users', async t => {
    await db._util.clearDb()

    const email1 = 'test@email.com'
    const email2 = 'test2@email.com'
    const password = 'testPass'
    const name = 'Lumpy Space Princess'

    const { data: { createUser: { email: email1Resp }}} = await mutate(server).noError()
      .asUnprived({ mutation: CREATE_USER, variables: { email: email1, password, role: 'ADMIN', name }})
    const { data: { createUser: { email: email2Resp }}} = await mutate(server).noError()
      .asUnprived({ mutation: CREATE_USER, variables: { email: email2, password, role: 'ADMIN', name }})

    t.equal(email1Resp, email1)
    t.equal(email2Resp, email2)

    const { data: { users }} = await query(server).noError().asUnprived({ query: GET_USERS })

    t.deepEqual(users, [{ email: email1 }, { email: email2 }])

    t.end()
  })

  test('GQL Create User -> Create Duplicate User', async t => {
    await db._util.clearDb()

    const email = 'test@email.com'
    const password = 'testPass'
    const name = 'Me Mow'

    const { data } = await mutate(server).asUnprived({ mutation: CREATE_USER, variables: { email, password, role: 'ADMIN', name }})
    const user = data?.createUser

    t.equal(user?.email, email)

    const { errors } = await mutate(server).asUnprived({ mutation: CREATE_USER, variables: { email, password, role: 'ADMIN', name }})
    const message = errors[0]?.message
    t.assert(message.includes('already exists'))

    t.end()
  })

  test('GQL Create User -> Update User', async t => {
    await db._util.clearDb()

    // The trick here is I'm doing as an admin a change to doctor, so we should see the role be doc, which
    // means the update went through.
    const { data: { updateMe: { role }} } = await mutate(server).noError().asAdmin({ mutation: UPDATE_ME, variables: { user: {
      role: 'DOCTOR',
      imageUrl: 'www.image.com'
    }}})

    // Make sure images can be set to nothing
    const { data: { updateMe: { imageUrl }}} = await mutate(server).noError().asAdmin({ mutation: UPDATE_ME, variables: { user: {
      imageUrl: ''
    }}})

    t.equal(role, 'DOCTOR')
    t.equal(imageUrl, '')

    const { data: refetchData } = await query(server).asAdmin({ query: ME })

    t.equal(refetchData?.me?.role, 'DOCTOR')
    t.equal(refetchData?.me?.imageUrl, '')

    t.end()
  })

  test('GQL Create User -> User has activity -> User lastVisit updates', async t => {
    await db._util.clearDb()

    await query(server).asDoctor({ query: GET_USERS })
    const { data: { me }} = await query(server).asDoctor({ query: ME })

    t.notEqual(me.joinDate, me.lastVisit)

    t.end()
  })

}
