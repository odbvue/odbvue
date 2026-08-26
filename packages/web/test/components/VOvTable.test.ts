import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VOvTable from '../../src/capabilities/ui/components/VOvTable.vue'
import { globalPlugins } from './setup'
import type { OvTableOptions, OvTableData } from '../index'

function mountTable(options: OvTableOptions, items: OvTableData[] = []) {
  return mount(VOvTable, {
    props: { options, items },
    global: { plugins: globalPlugins },
  })
}

const sampleData: OvTableData[] = [
  { name: 'Alice', email: 'alice@test.com', status: 'active' },
  { name: 'Bob', email: 'bob@test.com', status: 'blocked' },
  { name: 'Charlie', email: 'charlie@test.com', status: 'active' },
]

const baseOptions: OvTableOptions = {
  key: 'name',
  columns: [{ name: 'name' }, { name: 'email' }, { name: 'status' }],
  itemsPerPage: 10,
  mobileItemsPerPage: 10,
}

describe('VOvTable', () => {
  it('renders table with column headers', () => {
    const wrapper = mountTable(baseOptions, sampleData)
    expect(wrapper.text()).toContain('name')
    expect(wrapper.text()).toContain('email')
    expect(wrapper.text()).toContain('status')
  })

  it('renders row data', () => {
    const wrapper = mountTable(baseOptions, sampleData)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('bob@test.com')
    expect(wrapper.text()).toContain('blocked')
  })

  it('renders search bar when search option is set', () => {
    const wrapper = mountTable({ ...baseOptions, search: { placeholder: 'Search...' } }, sampleData)
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
  })

  it('renders with formatted columns', () => {
    const wrapper = mountTable(
      {
        key: 'name',
        columns: [
          { name: 'name' },
          {
            name: 'status',
            format: [
              {
                rules: { type: 'equals', params: 'active' },
                color: 'green',
              },
              { color: 'red' },
            ],
          },
        ],
        itemsPerPage: 10,
        mobileItemsPerPage: 10,
      },
      sampleData,
    )
    expect(wrapper.text()).toContain('active')
    expect(wrapper.text()).toContain('blocked')
  })

  it('renders empty state when no data', () => {
    const wrapper = mountTable(baseOptions, [])
    // Table component should render without errors
    expect(wrapper.html()).toBeTruthy()
  })

  it('renders row actions', () => {
    const wrapper = mountTable(
      {
        key: 'name',
        columns: [
          { name: 'name' },
          {
            name: 'actions',
            actions: [
              {
                name: 'edit',
                title: 'Edit record',
                format: { icon: '$edit' },
              },
            ],
          },
        ],
        itemsPerPage: 10,
        mobileItemsPerPage: 10,
      },
      sampleData,
    )
    expect(wrapper.html()).toContain('button')
  })

  it('renders action with title attribute', () => {
    const wrapper = mountTable(
      {
        key: 'name',
        columns: [
          { name: 'name' },
          {
            name: 'actions',
            actions: [
              {
                name: 'edit',
                title: 'Edit record',
                format: { icon: '$edit' },
              },
            ],
          },
        ],
        itemsPerPage: 10,
        mobileItemsPerPage: 10,
      },
      sampleData,
    )
    expect(wrapper.html()).toContain('edit')
  })

  it('emits fetch on mount', () => {
    const wrapper = mountTable(baseOptions, [])
    expect(wrapper.emitted('fetch')).toBeTruthy()
  })
})
