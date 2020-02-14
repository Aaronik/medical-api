import { gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { TModuleExport } from 'test/runner'

const CREATE_USER = gql`
  mutation ($email: String, $password: String){
    createUser(email: $email, password: $password) {
      id
      email
    }
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
}

