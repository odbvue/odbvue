import { onBeforeUnmount, ref } from 'vue'
import type { OvActionComplete } from '../api'

export function useFormSubmission() {
  const submitting = ref(false)
  let disposed = false

  onBeforeUnmount(() => {
    disposed = true
    submitting.value = false
  })

  function completeOnce(onComplete: OvActionComplete): OvActionComplete {
    let completed = false
    return (result) => {
      if (completed || disposed) return
      completed = true
      onComplete(result)
    }
  }

  function submit(emitAction: (complete: OvActionComplete) => void, onComplete: OvActionComplete) {
    if (submitting.value || disposed) return
    submitting.value = true
    emitAction(
      completeOnce((result) => {
        submitting.value = false
        onComplete(result)
      }),
    )
  }

  return { submitting, submit, completeOnce }
}
