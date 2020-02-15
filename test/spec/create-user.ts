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

export const test: TModuleExport = (test, knex, db, server) => {
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
}
