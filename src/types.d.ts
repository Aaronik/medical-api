export type User = {
  id: number
  name: string
  email: string
  joinDate: number
  lastVisit: number
  passwordHash: string
  role: Role
  imageUrl?: string
  birthday?: number
  adherence?: number
}

type Role = 'ADMIN' |'DOCTOR' |'PATIENT'

// When a user updates themselves
export type MeUserInput = {
  name: string
  email: string
  role: Role
  imageUrl: string
  birthday: number
}

// TODO Limitations of current system
// * Questions are only linear. In fact, there's no way to tell what's the
//   next question save for that it might have the next id.
//   Need them to be branchable based on response.

export type Questionnaire = {
  id: number
  title: string
  questions: Question[]
}

export type Question =
    BooleanQuestion
  | TextQuestion
  | SingleChoiceQuestion
  | MultipleChoiceQuestion

export interface BooleanQuestion extends QuestionMeta {
  type: 'BOOLEAN'
  response?: Boolean
}

export interface TextQuestion extends QuestionMeta {
  type: 'TEXT'
  response?: string
}

export interface SingleChoiceQuestion extends QuestionMeta {
  type: 'SINGLE_CHOICE'
  options: QuestionOption[]
  response?: string
}

export interface MultipleChoiceQuestion extends QuestionMeta {
  type: 'MULTIPLE_CHOICE'
  options: QuestionOption[]
  response?: string[]
}

export interface QuestionMeta {
  id: number
  questionnaireId: number
  questionnaire?: Questionnaire
  text: string
  type: QuestionType
  options?: QuestionOption[]
}

export type QuestionOption = {
  questionId: number
  question?: Question
  value: string
  text: string
}

export type QuestionType = 'TEXT' | 'MULTIPLE_CHOICE' | 'SINGLE_CHOICE' | 'BOOLEAN'
