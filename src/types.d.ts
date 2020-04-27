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
  patients?: User[]
  doctors?: User[]
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

export type Questionnaire = {
  id: number
  title: string
  assignmentInstanceId?: number
  questions: Question[]
}

export type QuestionnaireAssignment = {
  id: number
  questionnaireId: number
  questionnaire?: Questionnaire
  assigneeId: number
  assignee?: User
  assignerId: number
  repeatInterval: number // in minutes
}

export type QuestionnaireAssignmentInstance = {
  id: number
  created: Date
  assignmentId: number
  questionnaireId: number
  assigneeId: number
  assignerId: number
}

// This should be a larger pattern. The DB adds stuff
// but we still work with the type before it hits the DB.
export type PreDBQuestionnaireAssignmentInstance = {
  assignmentId: number
  questionnaireId: number
  assigneeId: number
  assignerId: number
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
  response?: QuestionOption
}

export interface MultipleChoiceQuestion extends QuestionMeta {
  type: 'MULTIPLE_CHOICE'
  options: QuestionOption[]
  response?: QuestionOption[]
}

export interface QuestionMeta {
  id: number
  questionnaireId: number
  questionnaire?: Questionnaire
  text: string
  type: QuestionType
  options?: QuestionOption[]
  next?: QuestionRelation[]
}

export type QuestionOption = {
  id: number
  questionId: number
  question?: Question
  text: string
}

export type QuestionRelation = {
  questionId?: number
  question?: Question
  nextQuestionId: number
  nextQuestion?: Question
  includes?: string
  equals?: string
}

export type QuestionType = 'TEXT' | 'MULTIPLE_CHOICE' | 'SINGLE_CHOICE' | 'BOOLEAN'

export type DBQuestionResponseBoolean = {
  questionId: number
  userId: number
  value: 0 | 1
}

export type DBQuestionResponseText = {
  questionId: number
  userId: number
  value: string
}

export type DBQuestionResponseChoice = {
  questionId: number
  userId: number
  optionId: number
}

export type TimelineItem = {
  className?: string;
  content: string;
  end?: string | Date;
  group?: number;
  id: number;
  start: string | Date;
  style?: string;
  subgroup?: number;
  title?: string;
  type?: TimelineItemType;
  editable?: boolean;
  selectable?: boolean;
}

export type TimelineGroup = {
  className?: string;
  content: string | HTMLElement;
  id: number;
  style?: string;
  order?: number;
  title?: string;
  visible?: boolean;
  nestedGroups?: number[];
  showNested?: boolean;
}

export type TimelineItemType = 'box' | 'point' | 'range' | 'background';
