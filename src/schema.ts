import { gql } from 'apollo-server'

export default gql`
  type Test {
    id: String
    thing: String
  }

  type Query {
    test: Test
  }
`
