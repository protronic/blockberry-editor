import type {SpaceResource} from '@opencloud-eu/web-client'

export function isSpaceResource(item: unknown): item is SpaceResource {
  return !!item && typeof item === 'object' && 'driveType' in item
}

function unrefMaybe<T>(value: T | (() => T) | {value: T} | undefined): T | undefined {
  if (value && typeof value === 'object' && 'value' in value) {
    return value.value
  }
  if (typeof value === 'function') {
    return (value as () => T)()
  }
  return value as T | undefined
}

export function resolveSidebarSpace(
  panelContext: Record<string, unknown> | undefined,
): SpaceResource | null {
  const root = unrefMaybe(panelContext?.root)
  if (isSpaceResource(root)) return root

  const parent = unrefMaybe(panelContext?.parent)
  if (isSpaceResource(parent)) return parent

  for (const key of ['space', 'currentSpace', 'activeSpace'] as const) {
    const candidate = unrefMaybe(panelContext?.[key])
    if (isSpaceResource(candidate)) return candidate
  }

  return null
}
