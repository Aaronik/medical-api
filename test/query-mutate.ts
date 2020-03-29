import { ApolloServer, gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { Role } from 'src/types.d'
import uuid from 'uuid/v4'

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

  const [ email, password, name ] = [ `${role || 'UNPRIVILEGED'}@millitestuser.com`, 'password', role || 'UNPRIVILEGED' ]

  // 1) Try to sign in w/ email/pass
  // If good: create prived client, run query
  // If error: create user, etc

  // First we'll try to sign in with this user's creds. If the user's been created already, we'll get
  // a token. Otherwise there'll be some error about that user not existing, which we'll disgard for now.
  let token = (await mutate({ mutation: AUTHENTICATE, variables: { email, password }})).data?.authenticate

  // So if the login didn't work, we'll assume that user has never been created (in this test at least).
  // So we create the user, and try to auth again.
  if (!token) {
    await mutate({ mutation: CREATE_USER, variables: { email, password, role, name }})
    token = (await mutate({ mutation: AUTHENTICATE, variables: { email, password }})).data?.authenticate
  }

  // If we still don't have a token it's because something is wrong somewhere down the line.
  if (!token) throw new Error(
    `QueryMutate: Milli custom mutate did not receive a token on sign in. Sorry
    for this being an error, but I don't have access to the test object from in here!`
  )

  // Remember, completely paradoxically, in order for our clients to be "signed in" using
  // createTestClient here, we have to fake an authorization header _on the server_ --
  // forcably implant it into the ApolloServer context function.
  // Because mutate and query can't send headers. See function definition.
  const privilegedClient = createTestClient(server, { authorization: token })

  if (queryOptions.mutation) {
    const result = await privilegedClient.mutate(queryOptions as Mutation)
    if (!shouldCheckErrors) return result
    if (result.errors !== undefined) throw new Error(
      'QueryMutate: noError was specified, but error(s) were returned: ' + JSON.stringify(result.errors)
    )
    return result
  } else {
    const result = await privilegedClient.query(queryOptions as Query)
    if (!shouldCheckErrors) return result
    if (result.errors !== undefined) throw new Error(
      'QueryMutate: noError was specified, but error(s) were returned: ' + JSON.stringify(result.errors)
    )
    return result
  }

}

type Mutation = Parameters<ReturnType<typeof createTestClient>['mutate']>['0']
type Query = Parameters<ReturnType<typeof createTestClient>['query']>['0']

const CREATE_USER = gql`
  mutation ($email: String, $password: String, $role: Role, $name: String) {
    createUser(email: $email, password: $password, role: $role, name: $name) {
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

