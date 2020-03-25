import { gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { TestModuleExport } from 'test/runner'
import { Question, Questionnaire, QuestionOption, QuestionType, QuestionRelation } from 'types'

// Questions, since they're unions, require an unwieldy fragment. Here it is for reuse.
const QUESTIONS_FRAGMENT = gql`
  {
    ... on BooleanQuestion {
      id
      type
      boolResp: response
      text
      next {
        includes
        equals
        nextQuestionId
      }
    }
    ... on TextQuestion {
      id
      type
      textResp: response
      text
      next {
        includes
        equals
        nextQuestionId
      }
    }
    ... on SingleChoiceQuestion {
      id
      type
      singleChoiceResp: response
      text
      options {
        value
        text
      }
      next {
        includes
        equals
        nextQuestionId
      }
    }
    ... on MultipleChoiceQuestion {
      id
      type
      multipleChoiceResp: response
      text
      options {
        value
        text
      }
      next {
        includes
        equals
        nextQuestionId
      }
    }
  }
`

const GET_QUESTIONNAIRE = gql`
  query Questionnaire($id: Int!) {
    questionnaire(id: $id) {
      id
      title
      questions ${QUESTIONS_FRAGMENT}
    }
  }
`

const GET_QUESTIONNAIRES = gql`
  query {
    questionnaires {
      id
      title
      questions ${QUESTIONS_FRAGMENT}
    }
  }
`

const GET_QUESTION = gql`
  query Question($id: Int!) {
    question(id: $id) ${QUESTIONS_FRAGMENT}
  }
`

const CREATE_QUESTIONNAIRE = gql`
  mutation CreateQuestionnaire($title: String, $questions: [QuestionInput]){
    createQuestionnaire(title: $title, questions: $questions) {
      id
      title
      questions ${QUESTIONS_FRAGMENT}
    }
  }
`

const ADD_QUESTION = gql`
  mutation AddQuestions($questions: [QuestionInput]) {
    addQuestions(questions: $questions) ${QUESTIONS_FRAGMENT}
  }
`

export const UPDATE_QUESTION = gql`
  mutation UpdateQuestion($question: QuestionInput!) {
    updateQuestion(question: $question) ${QUESTIONS_FRAGMENT}
  }
`

const DELETE_QUESTION = gql`
  mutation DeleteQuestion($id: Int!) {
    deleteQuestion(id: $id)
  }
`

const CREATE_QUESTION_RELATIONS = gql`
  mutation CreateQuestionRelations($relations: [QuestionRelationInput]) {
    createQuestionRelations(relations: $relations)
  }
`

const SUBMIT_BOOLEAN_RESPONSE = gql`
  mutation SubmitBoolean($questionId: Int!, $value: Boolean!) {
    submitBooleanQuestionResponse(questionId: $questionId, value: $value)
  }
`

const SUBMIT_TEXT_RESPONSE = gql`
  mutation SubmitText($questionId: Int!, $value: String!) {
    submitTextQuestionResponse(questionId: $questionId, value: $value)
  }
`

const SUBMIT_CHOICE_RESPONSE = gql`
  mutation SubmitChoice($questionId: Int!, $value: String!) {
    submitChoiceQuestionResponse(questionId: $questionId, value: $value)
  }
`

const DELETE_QUESTIONNAIRE = gql`
  mutation DeleteQuestionnaire($id: Int!) {
    deleteQuestionnaire(id: $id)
  }
`

const title = 'Questionnaire Test Title'

const questions: Omit<Omit<Question, 'id'>, 'questionnaireId'>[] = [
  {
    type: 'BOOLEAN',
    text: 'Sample Boolean Question',
  },
  {
    type: 'TEXT',
    text: 'Sample Text Question',
  },
  {
    type: 'SINGLE_CHOICE',
    text: 'Sample Single Choice Question',
    options: [ { value: 'val', text: 'text' } as QuestionOption ],
  },
  {
    type: 'MULTIPLE_CHOICE',
    text: 'Sample Multiple Choice Question',
    options: [ { value: 'val', text: 'text' } as QuestionOption ],
  },
]

export const test: TestModuleExport = (test, query, mutate, knex, db, server) => {
  test('GQL Add Questionnaire -> Get Questionnaire', async t => {
    const { data, errors } = await mutate(server).asUnprived({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    t.deepEqual(errors, undefined, 'Received unexpected GQL error')

    const questionnaire = data?.createQuestionnaire as Questionnaire

    t.equal(questionnaire?.title, title)
    t.equal(questionnaire?.questions?.length, questions.length)

    const singleChoiceQuestion = questionnaire?.questions?.find(q => q.type === 'SINGLE_CHOICE')
    const multipleChoiceQuestion = questionnaire?.questions?.find(q => q.type === 'MULTIPLE_CHOICE')

    t.deepEqual(singleChoiceQuestion?.options, [{ value: 'val', text: 'text' }])
    t.deepEqual(multipleChoiceQuestion?.options, [{ value: 'val', text: 'text' }])

    t.end()
  })

  test('GQL Add Questionnaire -> Get Question', async t => {
    const { data: { createQuestionnaire: questionnaire }} =
      await mutate(server).asUnprived({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    t.equal(questionnaire?.questions?.length, questions.length)

    const singleChoiceQuestion = questionnaire?.questions?.find(q => q.type === 'SINGLE_CHOICE')

    t.ok(singleChoiceQuestion.id)

    const { data: { question } } = await query(server).asUnprived({ query: GET_QUESTION, variables: { id: singleChoiceQuestion.id }})

    t.ok(question)

    t.end()
  })

  test('GQL Get Questionnaire that doesn\'t exist', async t => {
    await db._util.clearDb()

    const { data, errors } = await mutate(server).asUnprived({ mutation: GET_QUESTIONNAIRE, variables: { id: 42 } })
    const questionnaire = data?.createQuestionnaire

    t.deepEqual(errors, undefined, 'Received unexpected GQL error')
    t.equal(questionnaire, undefined)

    t.end()
  })

  test('GQL Submit Responses to Questionnaire -> Retrieve Questionnaire with responses', async t => {
    await db._util.clearDb()

    const createResp = await mutate(server).asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    t.deepEqual(createResp.errors, undefined, 'Received unexpected GQL error')

    const createdQuestionnaire = createResp.data?.createQuestionnaire

    const singleChoiceQuestion = createdQuestionnaire?.questions?.find(q => q.type === 'SINGLE_CHOICE')
    const multipleChoiceQuestion = createdQuestionnaire?.questions?.find(q => q.type === 'MULTIPLE_CHOICE')
    const booleanQuestion = createdQuestionnaire?.questions?.find(q => q.type === 'BOOLEAN')
    const textQuestion = createdQuestionnaire?.questions?.find(q => q.type === 'TEXT')

    const singleChoiceResponse = singleChoiceQuestion?.options?.[0]?.value
    const multipleChoiceResponse = multipleChoiceQuestion?.options?.[0]?.value

    const boolResp = await mutate(server).asPatient({ mutation: SUBMIT_BOOLEAN_RESPONSE, variables: { questionId: booleanQuestion.id, value: true }})
    const textResp = await mutate(server).asPatient({ mutation: SUBMIT_TEXT_RESPONSE, variables: { questionId: textQuestion.id, value: 'text answer' }})
    const singResp = await mutate(server).asPatient({ mutation: SUBMIT_CHOICE_RESPONSE, variables: { questionId: singleChoiceQuestion.id, value: singleChoiceResponse }})
    const multResp = await mutate(server).asPatient({ mutation: SUBMIT_CHOICE_RESPONSE, variables: { questionId: multipleChoiceQuestion.id, value: multipleChoiceResponse }})
    const getResp = await query(server).asPatient({ query: GET_QUESTIONNAIRE, variables: { id: createdQuestionnaire.id }})

    // Make sure no gql errors
    t.deepEqual(
      [boolResp.errors, textResp.errors, singResp.errors, multResp.errors, getResp.errors],
      [undefined, undefined, undefined, undefined, undefined],
      'Received unexpected GQL error'
    )

    const gottenQuestionnaire = getResp.data?.questionnaire

    const getQuestionOfType = (questionnaire?: Questionnaire, type?: QuestionType) => {
      // GraphQL requires using aliases for inline fragments that have similar keys of different types.
      // This wreaks havoc on our typescript types. On a real client implementation, we need to define a
      // specific type for each GraphQL request. This is why we cast to any here.
      return questionnaire?.questions?.find(q => q.type === type) as any
    }

    t.equal(getQuestionOfType(gottenQuestionnaire, 'BOOLEAN').boolResp, true)
    t.equal(getQuestionOfType(gottenQuestionnaire, 'TEXT').textResp, 'text answer')
    t.equal(getQuestionOfType(gottenQuestionnaire, 'SINGLE_CHOICE').singleChoiceResp, singleChoiceResponse)
    t.deepEqual(getQuestionOfType(gottenQuestionnaire, 'MULTIPLE_CHOICE').multipleChoiceResp, [multipleChoiceResponse])

    const { data: { questionnaires }} = await query(server).asPatient({ query: GET_QUESTIONNAIRES })

    t.equal(getQuestionOfType(questionnaires[0], 'BOOLEAN').boolResp, true)
    t.equal(getQuestionOfType(questionnaires[0], 'TEXT').textResp, 'text answer')
    t.equal(getQuestionOfType(questionnaires[0], 'SINGLE_CHOICE').singleChoiceResp, singleChoiceResponse)
    t.deepEqual(getQuestionOfType(questionnaires[0], 'MULTIPLE_CHOICE').multipleChoiceResp, [multipleChoiceResponse])

    t.end()
  })

  test('GQL Submit Questionnaire -> Submit Question Relations -> Get Questionnaire', async t => {
    const { data: { createQuestionnaire: createdQuestionnaire }, errors: createQuestionnaireErrors }
      = await mutate(server).asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    t.deepEqual(createQuestionnaireErrors, undefined)

    let booleanQuestion = createdQuestionnaire.questions.find(q => q.type === 'BOOLEAN')
    let textQuestion = createdQuestionnaire.questions.find(q => q.type === 'TEXT')
    let singleChoiceQuestion = createdQuestionnaire.questions.find(q => q.type === 'SINGLE_CHOICE')
    let multipleChoiceQuestion = createdQuestionnaire.questions.find(q => q.type === 'MULTIPLE_CHOICE')

    const relations: QuestionRelation[] = [
      {
        questionId: booleanQuestion.id,
        equals: 'true',
        nextQuestionId: textQuestion.id
      },
      {
        questionId: textQuestion.id,
        includes: 'wow',
        nextQuestionId: singleChoiceQuestion.id
      },
      {
        questionId: singleChoiceQuestion.id,
        equals: 'val',
        nextQuestionId: multipleChoiceQuestion.id
      },
    ]

    const { errors: createQuestionRelationErrors }
      = await mutate(server).asAdmin({ mutation: CREATE_QUESTION_RELATIONS, variables: { relations }})

    t.deepEqual(createQuestionRelationErrors, undefined)

    const { data: { questionnaire: gottenQuestionnaire }, errors: gottenQuestionnaireErrors }
      = await query(server).asAdmin({ query: GET_QUESTIONNAIRE, variables: { id: createdQuestionnaire.id }})

    t.deepEqual(gottenQuestionnaireErrors, undefined)

    booleanQuestion = gottenQuestionnaire.questions.find(q => q.type === 'BOOLEAN')
    textQuestion = gottenQuestionnaire.questions.find(q => q.type === 'TEXT')
    singleChoiceQuestion = gottenQuestionnaire.questions.find(q => q.type === 'SINGLE_CHOICE')
    multipleChoiceQuestion = gottenQuestionnaire.questions.find(q => q.type === 'MULTIPLE_CHOICE')

    t.deepEqual(booleanQuestion.next, [{ equals: 'true', nextQuestionId: textQuestion.id, includes: null }], 'Boolean question has correct next value')
    t.deepEqual(textQuestion.next, [{ includes: 'wow', nextQuestionId: singleChoiceQuestion.id, equals: null }], 'Text question has correct next value')
    t.deepEqual(singleChoiceQuestion.next, [{ equals: 'val', nextQuestionId: multipleChoiceQuestion.id, includes: null }], 'Single Choice question has correct next value')
    t.deepEqual(multipleChoiceQuestion.next, [], 'Multiple Choice question has empty next value')

    t.end()
  })

  test('GQL Submit questionnaire -> Add another question -> Get questionnaire', async t => {
    const { data: { createQuestionnaire: createdQuestionnaire }, errors: createQuestionnaireErrors }
      = await mutate(server).asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    t.deepEqual(createQuestionnaireErrors, undefined)

    const extraQuestions = [{
      questionnaireId: createdQuestionnaire.id,
      text: 'Added Question',
      type: 'SINGLE_CHOICE',
      options: [{ value: 'option', text: 'option' }]
    }]

    const { errors: addQuestionErrors } = await mutate(server).asAdmin({ mutation: ADD_QUESTION, variables: { questions: extraQuestions }})

    t.deepEqual(addQuestionErrors, undefined)

    const { data: { questionnaire: gottenQuestionnaire }, errors: gottenQuestionnaireErrors }
      = await query(server).asAdmin({ query: GET_QUESTIONNAIRE, variables: { id: createdQuestionnaire.id }})

    t.deepEqual(gottenQuestionnaireErrors, undefined)

    t.equal(gottenQuestionnaire.questions.length, questions.length + extraQuestions.length, 'Questionnaire should have all the extra questions')

    t.end()
  })

  test('GQL Submit Questionnaire -> Delete question', async t => {
    const { data: { createQuestionnaire: createdQuestionnaire }, errors: createQuestionnaireErrors }
      = await mutate(server).asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    t.deepEqual(createQuestionnaireErrors, undefined)

    const { errors: deleteQuestionErrors } = await mutate(server).asAdmin({ mutation: DELETE_QUESTION, variables: { id: createdQuestionnaire.questions[0].id } })

    t.deepEqual(deleteQuestionErrors, undefined)

    const { data: { questionnaire: gottenQuestionnaire }, errors: gottenQuestionnaireErrors }
      = await query(server).asAdmin({ query: GET_QUESTIONNAIRE, variables: { id: createdQuestionnaire.id }})

    t.deepEqual(gottenQuestionnaireErrors, undefined)

    t.equal(gottenQuestionnaire.questions.length, questions.length - 1, 'There should be one fewer question after a question has been deleted')

    t.end()
  })

  test('GQL Submit Questionnaire -> Update question', async t => {
    const { data: { createQuestionnaire: createdQuestionnaire }, errors: createQuestionnaireErrors }
      = await mutate(server).asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    t.deepEqual(createQuestionnaireErrors, undefined)

    const newText = 'Updated text'
    const updatedQuestion = Object.assign({}, createdQuestionnaire.questions[0], { text: newText })
    delete updatedQuestion.boolResp
    delete updatedQuestion.next

    const { errors: updateQuestionErrors } = await mutate(server).asAdmin({ mutation: UPDATE_QUESTION, variables: { question: updatedQuestion } })

    t.deepEqual(updateQuestionErrors, undefined)

    const { data: { questionnaire: gottenQuestionnaire }, errors: gottenQuestionnaireErrors }
      = await query(server).asAdmin({ query: GET_QUESTIONNAIRE, variables: { id: createdQuestionnaire.id }})

    t.deepEqual(gottenQuestionnaireErrors, undefined)

    t.equal(gottenQuestionnaire.questions[0].text, newText)

    t.end()
  })

  test('GQL Create multiple questionnaires -> get them all', async t => {
    await db._util.clearDb()

    const { errors: firstCreateQuestionnaireErrors }
      = await mutate(server).asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    t.deepEqual(firstCreateQuestionnaireErrors, undefined)

    const { errors: secondCreateQuestionnaireErrors }
      = await mutate(server).asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    t.deepEqual(secondCreateQuestionnaireErrors, undefined)

    const { data: { questionnaires }, errors } = await query(server).asAdmin({ query: GET_QUESTIONNAIRES })

    t.deepEqual(errors, undefined)
    t.equal(questionnaires.length, 2, 'Getting all questionnaires should return two questionnaires')

    t.end()
  })

  test('GQL Create questionnaire -> delete questionnaire -> get them all', async t => {
    await db._util.clearDb()

    const { data: { createQuestionnaire: createdQuestionnaire }, errors: createQuestionnaireErrors }
      = await mutate(server).asAdmin({ mutation: CREATE_QUESTIONNAIRE, variables: { title, questions }})

    t.deepEqual(createQuestionnaireErrors, undefined)

    const { errors: deleteErrors } = await mutate(server).asAdmin({ mutation: DELETE_QUESTIONNAIRE, variables: { id: createdQuestionnaire.id }})

    t.deepEqual(deleteErrors, undefined)

    const { data: { questionnaires }, errors: getErrors } = await query(server).asAdmin({ query: GET_QUESTIONNAIRES })

    t.deepEqual(getErrors, undefined)

    t.deepEqual(questionnaires, [], 'There shouldn\'t be any questionnaires after one is created and one is deleted')

    t.end()
  })
}
