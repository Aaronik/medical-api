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

const UPDATE_ITEM = gql`
  mutation UpdateItem($item: TimelineItemInput!) {
    updateTimelineItem(item: $item) {
      id
      content
      title
      start
      end
      userId
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

const GET_ITEM = gql`
  query GetItem($id: Int!) {
    timelineItem(id: $id) {
      id
      content
      title
    }
  }
`

const CREATE_GROUP = gql`
  mutation CreateGroup($group: TimelineGroupInput!) {
    createTimelineGroup(group: $group) {
      id
    }
  }
`

const GET_GROUPS = gql`
  query TimelineGroups {
    timelineGroups {
      id
      content
      title
    }
  }
`

const UPDATE_GROUP = gql`
  mutation UpdateGroup($group: TimelineGroupInput!) {
    updateTimelineGroup(group: $group) {
      id
      content
      title
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

  test('GQL Create Timeline Item -> Get My Items', async t => {
    await db._util.clearDb()

    const item: Omit<T.TimelineItem, 'id'> = {
      content: 'test content',
      start: new Date().toString(),
    }

    const { data: { me: { id: meId }}} = await query(server).noError().asPatient({ query: ME })
    const { data: { createTimelineItem: { id }}} = await mutate(server).noError().asPatient({ mutation: CREATE_ITEM, variables: { item } })
    const { data: { timelineItems: items }} = await query(server).noError().asPatient({ query: GET_ITEMS, variables: { userId: meId }})

    t.equal(items.length, 1)
    t.equal(items[0].content, item.content)

    t.end()
  })

  test('GQL Create Timeline Item -> Update Item -> Get Item', async t => {
    await db._util.clearDb()

    const item: Omit<T.TimelineItem, 'id'> = {
      content: 'test content',
      start: new Date().toString(),
    }

    const { data: { createTimelineItem: { id }}} = await mutate(server).noError().asPatient({ mutation: CREATE_ITEM, variables: { item } })
    const updatedItem = Object.assign({}, item, { title: 'Update title', id })
    await mutate(server).noError().asPatient({ mutation: UPDATE_ITEM, variables: { item: updatedItem }})
    const { data: { timelineItem: gottenItem }} = await query(server).noError().asPatient({ query: GET_ITEM, variables: { id }})

    t.ok(gottenItem)
    t.equal(gottenItem.content, item.content)
    t.equal(gottenItem.title, updatedItem.title)

    t.end()
  })

  test('GQL Create Timeline Groups -> Uppate Group -> Get Groups', async t => {
    await db._util.clearDb()

    const group1: Omit<T.TimelineGroup, 'id'> = {
      content: 'group1'
    }

    const group2: Omit<T.TimelineGroup, 'id'> = {
      content: 'group2'
    }

    const { data: { createTimelineGroup: { id: id1 }}} = await mutate(server).noError().asPatient({ mutation: CREATE_GROUP, variables: { group: group1 } })
    const { data: { createTimelineGroup: { id: id2 }}} = await mutate(server).noError().asPatient({ mutation: CREATE_GROUP, variables: { group: group2 } })

    t.ok(id1)
    t.ok(id2)

    const groupUpdate = Object.assign({}, group2, { title: 'update title', id: id2 })

    await mutate(server).noError().asPatient({ mutation: UPDATE_GROUP, variables: { group: groupUpdate }})

    const { data: { timelineGroups: groups }} = await mutate(server).noError().asPatient({ mutation: GET_GROUPS })
    const updatedGroup = groups.find(g => g.title === groupUpdate.title)

    t.equal(groups.length, 2)
    t.ok(updatedGroup)

    t.end()
  })

}


