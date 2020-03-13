import { gql } from 'apollo-server'
import createTestClient from 'test/create-test-client'
import { TestModuleExport } from 'test/runner'
import * as T from 'types'

const CREATE_ITEM = gql`
  mutation CreateItem($item: TimelineItemInput!) {
    createTimelineItem(item: $item) {
      id
    }
  }
`

const GET_ITEMS = gql`
  query GetItems($userId: Int!) {
    timelineItems(userId: $userId) {
      content
    }
  }
`

const CREATE_GROUP = gql`
  mutation CreateGroup($group: TimelineGroupInput!) {
    createTimelineGroup(item: $group) {
      id
    }
  }
`

const ME = gql`
  query {
    me {
      id
    }
  }
`

export const test: TestModuleExport = (test, query, mutate, knex, db, server) => {

  test('GQL Create Timeline Item -> Get Timeline Item', async t => {
    await db._util.clearDb()

    const item: Omit<T.TimelineItem, 'id'> = {
      content: 'test content',
      start: new Date().toString(),
    }

    const { data: { me: { id: meId }}} = await query(server).asPatient({ query: ME })

    const { data: { createTimelineItem: { id }}, errors } = await mutate(server).asPatient({ mutation: CREATE_ITEM, variables: { item } })
    t.deepEqual(errors, undefined)

    const { data: { timelineItems: items }} = await query(server).asPatient({ query: GET_ITEMS, variables: { userId: meId }})

    t.equal(items.length, 1)
    t.equal(items[0].content, item.content)

    t.end()
  })

}


