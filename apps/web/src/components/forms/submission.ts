import { onBeforeUnmount, ref } from 'vue'
import type { OvActionComplete } from '../api'

export function useFormSubmission() {
  const submitting = ref(false)
  let disposed = false
  let diagnostic: ReturnType<typeof setTimeout> | undefined

  onBeforeUnmount(() => {
    disposed = true
    submitting.value = false
    clearTimeout(diagnostic)
  })

  function completeOnce(onComplete: OvActionComplete): OvActionComplete {
    let completed = false
    return (result) => {
      if (completed || disposed) return
      completed = true
      onComplete(result)
    }
  }

  function submit(
    actionName: string,
    emitAction: (complete: OvActionComplete) => void,
    onComplete: OvActionComplete,
  ) {
    if (submitting.value || disposed) return
    submitting.value = true
    if (import.meta.env.DEV) {
      diagnostic = setTimeout(() => {
        console.warn(
          `Generated form action "${actionName}" is still pending after 30 seconds; ensure its handler calls complete() on every outcome.`,
        )
      }, 30_000)
    }
    emitAction(
      completeOnce((result) => {
        clearTimeout(diagnostic)
        diagnostic = undefined
        submitting.value = false
        onComplete(result)
      }),
    )
  }

  return { submitting, submit, completeOnce }
}
