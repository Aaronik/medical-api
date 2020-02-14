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
    birthday: Int
  }

  type QuestionnaireAssignment {
    questionnaire: Questionnaire
    assignee: User
    assigner: User

    assignedAt: Int
    expiryTime: Int

    questionsCompleted: Int
    completedAt: Int
  }

  type Questionnaire {
    id: Int
    questions: [Question]
  }

  enum QuestionType {
    TEXT # Single Input
    MULTIPLE_CHOICE # Checkbox Ex "Select all that apply.."
    SINGLE_CHOICE # Radiogroup Ex "Choose the best answer.."
    BOOLEAN # Boolean
  }

  interface QuestionMeta {
    id: Int
    questionnaire: Questionnaire

    # The question text the user sees
    text: String
    type: QuestionType
  }

  type TextQuestion implements QuestionMeta {
    id: Int
    questionnaire: Questionnaire
    text: String

    # This will always be "TEXT"
    type: QuestionType
    response: String
  }

  type QuestionOption {
    value: String
    text: String
  }

  type MultipleChoiceQuestion implements QuestionMeta {
    id: Int
    questionnaire: Questionnaire
    text: String

    # This will always be "MULTIPLE_CHOICE"
    type: QuestionType
    options: [QuestionOption]

    # collection of QuestionOption values
    response: [String]
  }

  type SingleChoiceQuestion implements QuestionMeta {
    id: Int
    questionnaire: Questionnaire
    text: String

    # This will always be "SINGLE_CHOICE"
    type: QuestionType
    options: [QuestionOption]

    # A single QuestionOption value
    response: String
  }

  type BooleanQuestion implements QuestionMeta {
    id: Int
    questionnaire: Questionnaire
    text: String

    # This will always be "BOOLEAN"
    type: QuestionType
    response: Boolean
  }

  union Question =
      TextQuestion
    | MultipleChoiceQuestion
    | SingleChoiceQuestion
    | BooleanQuestion

  type Query {
    me: User
    user(id: Int!): User
    users: [User]
    questionnaire(id: Int!): Questionnaire
    question(id: Int!): Question
  }

  type Mutation {
    createUser(email:String, password:String): User
    authenticate(email:String, password:String): String
    deauthenticate: Boolean
    submitQuestionResponse: Boolean
  }
`
