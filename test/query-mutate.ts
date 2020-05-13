import { ApolloServer, gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { Role } from 'src/types.d'
import uuid from 'uuid/v4'
import knex from 'test/db-connection'

/*
 * These help making privileged operations much, much easier. They handle creating a user with appropriate privs,
 * authenticating, and storing and using that token.
 *
 * Each invocation will attempt to reuse that user's creds. So say if you create a <thing> with the Patient user,
 * then try to retrieve all of the patient user's <thing>s, you should get them.
 *
 * You can prefix your calls with noError() and this'll ensure your requests return no GQL errors.
 * It checks before you destructure your return data, so you don't need an ex. data?.me?.user?.id or whatever.
 *
 * Ex.
 *
 * await mutate(server).asDoctor({ mutation: UPDATE_ME, variables: { whatevs: yeah } })
 *
 * or
 *
 * const { data: { me: { id }}} = await query(server).noError().asDoctor({ query: ME, variables: { thinktheres: novarsforthisone } })
*/

export const mutate = (server: ApolloServer) => {
  let shouldCheckErrors = false

  const returnObj = {
    asUnprived: async (queryOptions: Mutation) => runGqlAs(shouldCheckErrors, queryOptions, server),
    asPatient: async (queryOptions: Mutation) => runGqlAs(shouldCheckErrors, queryOptions, server, 'PATIENT'),
    asDoctor: async (queryOptions: Mutation) => runGqlAs(shouldCheckErrors, queryOptions, server, 'DOCTOR'),
    asAdmin: async (queryOptions: Mutation) => runGqlAs(shouldCheckErrors, queryOptions, server, 'ADMIN'),
    noError: () => {
      shouldCheckErrors = true
      return returnObj
    }
  }

  return returnObj
}

export const query = (server: ApolloServer) => {
  let shouldCheckErrors = false

  const returnObj = {
    asUnprived: async (queryOptions: Query) => runGqlAs(shouldCheckErrors, queryOptions, server),
    asPatient: async (queryOptions: Query) => runGqlAs(shouldCheckErrors, queryOptions, server, 'PATIENT'),
    asDoctor: async (queryOptions: Query) => runGqlAs(shouldCheckErrors, queryOptions, server, 'DOCTOR'),
    asAdmin: async (queryOptions: Query) => runGqlAs(shouldCheckErrors, queryOptions, server, 'ADMIN'),
    noError: () => {
      shouldCheckErrors = true
      return returnObj
    }
  }

  return returnObj
}

const runGqlAs = async (shouldCheckErrors: boolean, queryOptions: Mutation | Query, server: ApolloServer, role?: Role) => {
  const { mutate, query } = createTestClient(server)

  if (!role) {
    // We're running as an unprivileged user. Can skip all the user creation stuff.
    if (queryOptions.mutation) return mutate(queryOptions as Mutation)
    else                       return query(queryOptions as Query)
  }

  const email = `${role || 'UNPRIVILEGED'}@millitestuser.com`

  // Sign in with email
  // * send requestAuthCode mutation with email
  // * Get code from db directly
  // * send submitAuthCode mutation with code
  // * Update role of user in db directly
  // * Use token to create test client

  // 1) send requestAuthCode
  await mutate({ mutation: REQUEST_AUTH_CODE, variables: { email }})

  // 2) Steal code from DB
  const codeData = await knex('UserAuthCode').where({ email }).select('*').first()
  const code = codeData.code

  // 3) send submitAuthcodeMutation with code
  const { data: tokenData } = await mutate({ mutation: SUBMIT_AUTH_CODE, variables: { code }})
  const token = tokenData.submitAuthCode

  // 4) update role of user
  await knex('User').where({ email }).update({ role })

  // 5) create test client
  // Remember, completely paradoxically, in order for our clients to be "signed in" using
  // createTestClient here, we have to fake an authorization header _on the server_ --
  // forcably implant it into the ApolloServer context function.
  // Because mutate and query can't send headers. See function definition.
  const privilegedClient = createTestClient(server, { authorization: token })

  // Now we just need to run the query!
  let result

  if (queryOptions.mutation) result = await privilegedClient.mutate(queryOptions as Mutation)
  else                       result = await privilegedClient.query(queryOptions as Query)

  if (!shouldCheckErrors) return result

  if (result.errors !== undefined) throw new Error(
    'QueryMutate: noError was specified, but error(s) were returned: ' + JSON.stringify(result.errors)
  )

  return result
}

type Mutation = Parameters<ReturnType<typeof createTestClient>['mutate']>['0']
type Query = Parameters<ReturnType<typeof createTestClient>['query']>['0']

const REQUEST_AUTH_CODE = gql`
  mutation RequestAuthCode($email:String) {
    requestAuthCode(email: $email)
  }
`

const SUBMIT_AUTH_CODE = gql`
  mutation SubmitAuthCode($code:String!) {
    submitAuthCode(code: $code)
  }
`
