import { gql } from 'apollo-server'

export default gql`
  type User {
    id: Int
    name: String
    email: String
    joinDate: String
    lastVisit: String
    adherence: Int
    imageUrl: String
    birthday: String
  }

  type Query {
    me: User
    user(id: Int): User
    users: [User]
  }

  type Mutation {
    createUser(email:String, password:String): User
    authenticate(email:String, password:String): String
    deauthenticate: Boolean
  }
`
