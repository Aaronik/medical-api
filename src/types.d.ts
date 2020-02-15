export type User = {
  id: number
  name: string
  email: string
  joinDate: number
  lastVisit: number
  passwordHash: string
  imageUrl?: string
  birthday?: string
  adherence?: number
}

export type Questionnaire = {
  id: number
  title: string
  questions: [Question]
}

export type Question =
    BooleanQuestion
  | TextQuestion
  | SingleChoiceQuestion
  | MultipleChoiceQuestion

export interface BooleanQuestion extends QuestionMeta {
  type: QuestionType.BOOLEAN
  response?: Boolean
}

export interface TextQuestion extends QuestionMeta {
  type: QuestionType.TEXT
  response?: string
}

export interface SingleChoiceQuestion extends QuestionMeta {
  type: QuestionType.SINGLE_CHOICE
  options: [QuestionOption]
  response?: string
}

export interface MultipleChoiceQuestion extends QuestionMeta {
  type: QuestionType.MULTIPLE_CHOICE
  options: [QuestionOption]
  response?: [string]
}

export interface QuestionMeta {
  id: number
  questionnaireId: number
  questionnaire?: Questionnaire
  text: string
  type: QuestionType
}

export type QuestionOption = {
  value: string
  text: string
}

export enum QuestionType {
  TEXT = 'TEXT',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  BOOLEAN = 'BOOLEAN'
}

