import { gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { TestModuleExport } from 'test/runner'

const ME = gql`
  query {
    me{
      email
      name
      role
      lastVisit
      joinDate
      imageUrl
      patients {
        id
      }
    }
  }
`

const DEAUTH = gql`
  mutation {
    deauthenticate
  }
`

const SUBMIT_AUTH_CODE = gql`
  mutation SubmitAuthCode($code:String!) {
    submitAuthCode(code: $code)
  }
`

const REQUEST_AUTH_CODE = gql`
  mutation RequestAuthCode($email:String, $phone:String) {
    requestAuthCode(email: $email, phone: $phone)
  }
`

const INVITE_PATIENT = gql`
  mutation SendInvite($name:String, $email:String, $phone:String, $role:Role!) {
    sendInvite(name:$name, email:$email, phone:$phone, role:$role)
  }
`

export const test: TestModuleExport = (test, query, mutate, knex, db, server) => {

  test('GQL send invite with ADMIN role', async t => {
    await db._util.clearDb()

    const name = 'Hue'
    const email = 'Hue@theb.org'
    const phone = '5557434046'
    const role = 'ADMIN'

    const { errors } = await mutate(server).asDoctor({ mutation: INVITE_PATIENT, variables: { name, email, phone, role }})

    t.ok(errors)

    t.end()
  })

  test('GQL send invite from non doctors', async t => {
    await db._util.clearDb()

    const name = 'Picard'
    const email = 'JL@starfleet.org'
    const role = 'PATIENT'

    const { errors } = await mutate(server).asPatient({ mutation: INVITE_PATIENT, variables: { name, email, role }})

    t.ok(errors)

    t.end()
  })

  test('GQL Invited patient becomes related to doctor', async t => {
    await db._util.clearDb()

    const name = '7'
    const email = '7of9@hunters.io'
    const role = 'PATIENT'

    // Send invitation
    await mutate(server).noError().asDoctor({ mutation: INVITE_PATIENT, variables: { name, email, role }})

    // Accept invitation
    const { code } = await knex('UserAuthCode').where({ email }).select('code').first()
    await mutate(server).noError().asUnprived({ mutation: SUBMIT_AUTH_CODE, variables: { code }})

    // Ensure when invitation was accepted the user became a patient of mine
    const { data: { me }} = await query(server).noError().asDoctor({ query: ME })

    t.ok(me.patients[0].id)

    t.end()
  })

  test('GQL Invited doctor does not become related to doctor', async t => {
    await db._util.clearDb()

    const name = 'Crusher'
    const email = 'CrushedIt@starfleet.org'
    const role = 'DOCTOR'

    // Send invitation
    await mutate(server).noError().asDoctor({ mutation: INVITE_PATIENT, variables: { name, email, role }})

    // Accept invitation
    const { code } = await knex('UserAuthCode').where({ email }).select('code').first()
    await mutate(server).noError().asUnprived({ mutation: SUBMIT_AUTH_CODE, variables: { code }})

    const { data: { me }} = await query(server).noError().asDoctor({ query: ME })

    t.deepEqual(me.patients, [])

    t.end()
  })

  test('GQL invitation/auth code request with invalid data throws', async t => {
    await db._util.clearDb()

    const name = 'Wesley'
    const phone = 'feelin-wise'
    const email = 'messin everything up'
    const role = 'PATIENT'

    // Test invites and phone
    {
      const { errors } = await mutate(server).asDoctor({ mutation: INVITE_PATIENT, variables: { name, phone, role }})
      t.ok(errors)
    }

    // Test invites and email
    {
      const { errors } = await mutate(server).asDoctor({ mutation: INVITE_PATIENT, variables: { name, email, role }})
      t.ok(errors)
    }

    // Test auth code and phone
    {
      const { errors } = await mutate(server).asDoctor({ mutation: REQUEST_AUTH_CODE, variables: { phone }})
      t.ok(errors)
    }

    // Test auth code and email
    {
      const { errors } = await mutate(server).asDoctor({ mutation: REQUEST_AUTH_CODE, variables: { email }})
      t.ok(errors)
    }

    t.end()
  })

}

