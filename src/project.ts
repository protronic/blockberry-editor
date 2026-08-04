export type ProjectPreview = {
  /** Branded SVG data URI of a block silhouette + chrome. */
  image: string
  blockCount: number
  width: number
  height: number
  generatedAt: string
}

export type ProjectFile = {
  format: 'blockberry'
  version: 1
  name: string
  savedAt: string
  workspace: object
  preview?: ProjectPreview
  /** Optional device profile id (e.g. pico_telemetry). */
  deviceProfile?: string
}

export function isProjectFile(value: unknown): value is ProjectFile {
  if (!value || typeof value !== 'object') return false
  const project = value as Partial<ProjectFile>
  return (
    project.format === 'blockberry' &&
    project.version === 1 &&
    !!project.workspace &&
    typeof project.workspace === 'object'
  )
}

export function parseProject(content: string): ProjectFile {
  const project = JSON.parse(content) as unknown
  if (!isProjectFile(project)) {
    throw new Error('Keine gültige BlockBerry-Projektdatei')
  }
  return project
}

export function serializeProject(project: ProjectFile): string {
  return JSON.stringify(project, null, 2)
}

export function projectSignature(
  project: Pick<ProjectFile, 'name' | 'workspace' | 'deviceProfile'>,
): string {
  return JSON.stringify({
    name: project.name,
    workspace: project.workspace,
    deviceProfile: project.deviceProfile ?? '',
  })
}

export function stripKnownProjectExtension(name: string | undefined): string {
  return (
    name?.replace(/\.bbprj$|\.blockberry\.json$|\.json$/i, '') ||
    'Neue Steuerung'
  )
}
