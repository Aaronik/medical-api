import { gql } from 'apollo-server'

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

    allQuestionnaires: [Questionnaire]
    questionnaire(id: Int!): Questionnaire
    question(id: Int!): Question

    " The questionnaires that are assigned to me as a patient "
    questionnairesAssignedToMe: [Questionnaire]

    " The questionnaires that I created as a doctor "
    questionnairesIMade: [Questionnaire]

    " As a doctor, the responses (in questionnaire form) my patient has submitted "
    patientQuestionnaireResponses(patientId: Int!): [Questionnaire]

    " As a doctor, a listing of which questionnaires I've assigned to which patients "
    questionnaireAssignmentsIMade: [QuestionnaireAssignment]
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

    createQuestionnaire(title: String, questions: [QuestionInput]): Questionnaire
    updateQuestionnaire(id: Int!, title: String, questions: [QuestionInput]): Questionnaire
    deleteQuestionnaire(id: Int!): Boolean

    addQuestions(questions: [QuestionInput]): [Question]
    updateQuestion(question: QuestionInput!): Question
    deleteQuestion(id: Int!): Boolean
    createQuestionRelations(relations: [QuestionRelationInput]): Boolean

    submitBooleanQuestionResponse(questionId: Int!, assignmentInstanceId: Int!, value: Boolean!): Boolean
    submitTextQuestionResponse(questionId: Int!, assignmentInstanceId: Int!, value: String!): Boolean
    submitChoiceQuestionResponse(questionId: Int!, assignmentInstanceId: Int!, optionId: Int!): Boolean
    submitChoiceQuestionResponses(questionId: Int!, assignmentInstanceId: Int!, optionIds: [Int]!): Boolean

    createQuestionnaireAssignment(assignment: QuestionnaireAssignmentInput!): QuestionnaireAssignment
    updateQuestionnaireAssignment(assignment: QuestionnaireAssignmentUpdateInput!): QuestionnaireAssignment
    deleteQuestionnaireAssignment(id: Int!): Boolean
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
    assignmentInstanceId: Int
    questions: [Question]
  }

  type QuestionnaireAssignment {
    id: Int
    created: String
    repeatInterval: Int
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

    "Collection of QuestionOptions"
    response: [QuestionOption]
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
    response: QuestionOption
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

  input QuestionnaireAssignmentInput {
    questionnaireId: Int!
    assigneeId: Int!

    " A 0 value means don't repeat at all "
    repeatInterval: Int
  }

  input QuestionnaireAssignmentUpdateInput {
    id: Int!
    questionnaireId: Int
    assigneeId: Int

    " A 0 value means don't repeat at all "
    repeatInterval: Int
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
    id: Int
    text: String
  }

  input QuestionOptionInput {
    id: Int
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
