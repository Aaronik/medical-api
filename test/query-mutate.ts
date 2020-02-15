import { ApolloServer, gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { Role } from 'src/types.d'
import uuid from 'uuid/v4'

// const { createUser } = await mutate(server).asAdmin({ mutation: CREATE_USER, variables: { email, password }})
/*
 * These help making privileged operations much, much easier. They handle creating a user with appropriate privs,
 * authenticating, and storing and using that token.
 *
 * Each invocation of any function other than asUnprived with result in the creation of a new
 * user in the test database. I don't foresee that being an issue though. TODO there may actually
 * be a nice way around that.
 *
*/
export const mutate = (server: ApolloServer) => ({
  asUnprived: async (queryOptions: Mutation | Query) => runGqlAs(queryOptions, server),
  asPatient: async (queryOptions: Mutation | Query) => runGqlAs(queryOptions, server, 'PATIENT'),
  asDoctor: async (queryOptions: Mutation | Query) => runGqlAs(queryOptions, server, 'DOCTOR'),
  asAdmin: async (queryOptions: Mutation | Query) => runGqlAs(queryOptions, server, 'ADMIN'),
})

// Actually sticking with separation of query/mutate, even though they're the same here. I think
// it's best practice to use the two, and it'll keep this implementation flexible and as close
// to the original thing as possible.
export const query = mutate

const runGqlAs = async (queryOptions: Mutation | Query, server: ApolloServer, role?: Role) => {
  const { mutate, query } = createTestClient(server)

  if (!role) {
    // We're running as an unprivileged user. Can skip all the user creation stuff.

    if (queryOptions.mutation) return mutate(queryOptions as Mutation)
    else                       return query(queryOptions as Query)
  }

  const [ email, password ] = [ `${role || 'unprivileged'}-${uuid()}@millihealthtestusers.com`, 'password' ]

  await mutate({ mutation: CREATE_USER, variables: { email, password, role }})

  const token = (await mutate({ mutation: AUTHENTICATE, variables: { email, password }})).data?.authenticate

  if (!token) throw new Error(
    `Whoops, Milli custom mutate did not receive a token on sign in. Sorry
    for this being an error, but I don't have access to the test object from in here!`
  )

  // Remember, completely paradoxically, in order for our clients to be "signed in" using
  // createTestClient here, we have to fake an authorization header _on the server_ --
  // forcably implant it into the ApolloServer context function.
  // Because mutate and query can't send headers. See function definition.
  const privilegedClient = createTestClient(server, { authorization: token })

  if (queryOptions.mutation) return privilegedClient.mutate(queryOptions as Mutation)
  else                       return privilegedClient.query(queryOptions as Query)
}

type Mutation = Parameters<ReturnType<typeof createTestClient>['mutate']>['0']
type Query = Parameters<ReturnType<typeof createTestClient>['query']>['0']

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

