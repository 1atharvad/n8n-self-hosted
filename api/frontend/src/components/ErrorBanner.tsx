import { useLogStore } from '@/store/useLogStore'

export function ErrorBanner() {
  const error = useLogStore((s) => s.error)
  const clearError = useLogStore((s) => s.clearError)

  if (!error) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive text-[#ff7b72] text-xs shrink-0">
      <span>⚠ {error}</span>
      <button
        className="ml-auto bg-transparent border-none text-inherit cursor-pointer text-sm leading-none"
        onClick={clearError}
      >
        ✕
      </button>
    </div>
  )
}
