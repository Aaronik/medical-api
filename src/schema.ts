import { gql } from 'apollo-server'

// TODO:
// * Implement myQuestionnaires
// * Implement createQuestionnaireAssignment
// * How will a questionnaire assignment be removed?
//   * When the questionnaire has been completely finished (very tricky b/c of `next` options)
//   * It won't, it'll just be marked as completed by the FE (could basically be if it was started, at least for now.)
//     * Then all questionnaires will always be fetched when getting myQuestionnaires
//   * Kick the can down the road by implementing a SS function `isQuestionnaireComplete` or something that
//     will adorn the questionnaire with another field, `completionStatus` or something with options:
//     COMPLETE, IN_PROGRESS, UNSTARTED

export default gql`

  type Query {
    me: User
    user(id: Int!): User
    users: [User]
    patients: [User]
    doctors: [User]

    timelineItems(userId: Int!): [TimelineItem]
    timelineItem(id: Int!): TimelineItem
    timelineGroups: [TimelineGroup]
    timelineGroup(id: Int!): TimelineGroup

    questionnaires: [Questionnaire]
    questionnaire(id: Int!): Questionnaire
    question(id: Int!): Question

    " The questionnaires that are assigned to me as a patient "
    myQuestionnaires: [Questionnaire]

    " The questionnaire assignments that I've created as a doctor "
    myQuestionnaireAssignments: [QuestionnaireAssignment]
  }

  type Mutation {
    createUser(email:String, password:String, role:Role, name:String): User
    updateMe(user:MeInput): User

    authenticate(email:String, password:String): String
    deauthenticate: Boolean

    assignPatientToDoctor(patientId: Int!, doctorId: Int!): Boolean
    unassignPatientFromDoctor(patientId: Int!, doctorId: Int!): Boolean

    createTimelineItem(item: TimelineItemInput!): TimelineItem
    updateTimelineItem(item: TimelineItemInput!): TimelineItem
    createTimelineGroup(group: TimelineGroupInput!): TimelineGroup
    updateTimelineGroup(group: TimelineGroupInput!): TimelineGroup

    createQuestionnaire(title:String, questions: [QuestionInput]): Questionnaire
    deleteQuestionnaire(id: Int!): Boolean

    addQuestions(questions: [QuestionInput]): [Question]
    updateQuestion(question: QuestionInput!): Question
    deleteQuestion(id: Int!): Boolean
    createQuestionRelations(relations: [QuestionRelationInput]): Boolean

    submitBooleanQuestionResponse(questionId: Int!, value: Boolean!): Boolean
    submitTextQuestionResponse(questionId: Int!, value: String!): Boolean
    submitChoiceQuestionResponse(questionId: Int!, value: String!): Boolean
    submitChoiceQuestionResponses(questionId: Int!, values: [String]!): Boolean

    createQuestionnaireAssignment(questionnaireId: Int!, assigneeId: Int!): Boolean
    deleteQuestionnaireAssignment(questionnaireId: Int!, assigneeId: Int!): Boolean
  }

  ### Timeline

  type TimelineItem {
    id: Int
    className: String
    content: String
    end: String
    group: Int
    start: String
    style: String
    subgroup: Int
    title: String
    type: TimelineItemType
    editable: Boolean
    selectable: Boolean
    userId: Int
  }

  type TimelineGroup {
    id: Int
    className: String
    content: String
    style: String
    order: Int
    subgroupOrder: String
    title: String
    visible: Boolean
    nestedGroups: [Int]
    showNested: Boolean
  }

  enum TimelineItemType {
    box,
    point,
    range,
    background
  }

  input TimelineItemInput {
    id: Int
    className: String
    content: String
    end: String
    group: Int
    start: String
    style: String
    subgroup: Int
    title: String
    type: TimelineItemType
    editable: Boolean
    selectable: Boolean
    userId: Int
  }

  input TimelineGroupInput {
    id: Int
    className: String
    content: String
    style: String
    order: Int
    subgroupOrder: String
    title: String
    visible: Boolean
    nestedGroups: [Int]
    showNested: Boolean
  }

  ### User

  type User {
    id: Int
    name: String
    email: String
    role: Role
    joinDate: String
    lastVisit: String
    adherence: Int
    imageUrl: String
    birthday: String
    patients: [User]
    doctors: [User]
  }

  enum Role {
    ADMIN,
    DOCTOR,
    PATIENT
  }

  input MeInput {
    name: String
    email: String
    role: Role
    imageUrl: String
    birthday: String
  }

  ### Questionnaire

  type Questionnaire {
    id: Int
    title: String
    questions: [Question]
  }

  type QuestionnaireAssignment {
    assigneeId: Int
    assignee: User
    questionnaireId: Int
    questionnaire: Questionnaire
  }

  union Question =
      TextQuestion
    | MultipleChoiceQuestion
    | SingleChoiceQuestion
    | BooleanQuestion

  type TextQuestion implements QuestionMeta {
    id: Int
    questionnaire: Questionnaire
    text: String

    "This will always be 'TEXT'"
    type: QuestionType!
    response: String
    next: [QuestionRelation]
  }

  type MultipleChoiceQuestion implements QuestionMeta {
    id: Int
    questionnaire: Questionnaire
    text: String

    "This will always be 'MULTIPLE_CHOICE'"
    type: QuestionType!
    options: [QuestionOption]!

    "Collection of QuestionOption values"
    response: [String]
    next: [QuestionRelation]
  }

  type SingleChoiceQuestion implements QuestionMeta {
    id: Int
    questionnaire: Questionnaire
    text: String

    "This will always be 'SINGLE_CHOICE'"
    type: QuestionType!
    options: [QuestionOption]!

    "A single QuestionOption value"
    response: String
    next: [QuestionRelation]
  }

  type BooleanQuestion implements QuestionMeta {
    id: Int
    questionnaire: Questionnaire
    text: String

    "This will always be 'BOOLEAN'"
    type: QuestionType!
    response: Boolean
    next: [QuestionRelation]
  }

  enum QuestionType {
    "Single Input"
    TEXT

    "Checkbox Ex 'Select all that apply..'"
    MULTIPLE_CHOICE

    "Radiogroup Ex 'Choose the best answer..'"
    SINGLE_CHOICE

    "Boolean"
    BOOLEAN
  }

  input QuestionInput {
    "Only required when updating a question"
    id: Int
    text: String!
    type: QuestionType!
    options: [QuestionOptionInput]
    "Only required when creating a question for an already existing questionnaire"
    questionnaireId: Int
  }

  type QuestionOption {
    value: String
    text: String
  }

  input QuestionOptionInput {
    value: String
    text: String
  }

  type QuestionRelation {
    includes: String
    equals: String
    nextQuestionId: Int
  }

  input QuestionRelationInput {
    questionId: Int
    nextQuestionId: Int
    includes: String
    equals: String
  }

  interface QuestionMeta {
    id: Int
    questionnaire: Questionnaire

    "The question text the user sees"
    text: String
    type: QuestionType
    next: [QuestionRelation]
  }

`
