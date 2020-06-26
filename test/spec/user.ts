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
      name
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

  test('GQL Create User -> Update User', async t => {
    await db._util.clearDb()

    const newName = 'NEW DOCTOR'

    const { data: { updateMe: { name }} } = await mutate(server).noError().asDoctor({ mutation: UPDATE_ME, variables: { user: {
      name: newName,
      imageUrl: 'www.image.com'
    }}})

    // Make sure images can be set to nothing
    const { data: { updateMe: { imageUrl }}} = await mutate(server).noError().asDoctor({ mutation: UPDATE_ME, variables: { user: {
      imageUrl: ''
    }}})

    t.equal(name, newName)
    t.equal(imageUrl, '')

    const { data: refetchData } = await query(server).noError().asDoctor({ query: ME })

    t.equal(refetchData?.me?.name, newName)
    t.equal(refetchData?.me?.imageUrl, '')

    // Make sure users can't set their roles
    const { errors } = await mutate(server).asDoctor({ mutation: UPDATE_ME, variables: { user: { role: 'ADMIN' }}})

    t.ok(errors)

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
