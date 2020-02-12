import { gql } from 'apollo-server'

export default gql`
  type Test {
    tables: [String]
  }

  type User {
    id: String
    name: String
    email: String
    imageUrl: String!
    birthday: String!
    joinDate: String
    lastVisit: String
    adherence: Int!
  }

  type Query {
    test: Test
    user(id: String): User
  }
`
