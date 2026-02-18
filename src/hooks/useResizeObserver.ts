import { useEffect, useState } from 'react'

export interface Size {
  width: number
  height: number
}

export function useResizeObserver<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el)
      return

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry)
        return
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return size
}
