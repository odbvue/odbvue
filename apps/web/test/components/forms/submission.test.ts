import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { useFormSubmission } from '@/components/forms/submission'
import type { OvActionComplete } from '@/components/api'

describe('form submission diagnostics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('DEV', true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  function setup() {
    let submission!: ReturnType<typeof useFormSubmission>
    const wrapper = mount(
      defineComponent({
        setup() {
          submission = useFormSubmission()
          return () => null
        },
      }),
    )
    return { wrapper, submission }
  }

  it('warns about a pending action without ending it and allows late completion', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { wrapper, submission } = setup()
    let complete!: OvActionComplete
    const onComplete = vi.fn<OvActionComplete>()
    try {
      submission.submit('edit', (callback) => (complete = callback), onComplete)
      vi.advanceTimersByTime(29_999)
      expect(warn).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(warn).toHaveBeenCalledOnce()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"edit"'))
      expect(submission.submitting.value).toBe(true)
      complete({ status: 'error' })
      expect(submission.submitting.value).toBe(false)
      expect(onComplete).toHaveBeenCalledExactlyOnceWith({ status: 'error' })
    } finally {
      wrapper.unmount()
    }
  })

  it('cancels the completed diagnostic without affecting a new submission', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { wrapper, submission } = setup()
    let first!: OvActionComplete
    submission.submit('first', (callback) => (first = callback), vi.fn())
    first({ status: 'error' })
    vi.advanceTimersByTime(30_000)
    expect(warn).not.toHaveBeenCalled()
    submission.submit('second', () => {}, vi.fn())
    first({ status: 'success' })
    vi.advanceTimersByTime(30_000)
    expect(warn).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('cancels a pending diagnostic on unmount', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { wrapper, submission } = setup()
    submission.submit('edit', () => {}, vi.fn())
    wrapper.unmount()
    vi.advanceTimersByTime(30_000)
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not warn in production', () => {
    vi.stubEnv('DEV', false)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { wrapper, submission } = setup()
    try {
      submission.submit('edit', () => {}, vi.fn())
      vi.advanceTimersByTime(30_000)
      expect(warn).not.toHaveBeenCalled()
      expect(submission.submitting.value).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })
})
