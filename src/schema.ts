import { gql } from 'apollo-server'

export default gql`
  type User {
    id: Int
    name: String
    email: String
    imageUrl: String!
    birthday: String!
    joinDate: String
    lastVisit: String
    adherence: Int!
  }

  type Query {
    user(id: Int): User
    users: [User]
  }

  type Mutation {
    createUser(email:String, password:String): User
  }
`
