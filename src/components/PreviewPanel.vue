<template>
  <aside class="bb-preview-panel">
    <header class="bb-preview-header">
      <span class="bb-mark" aria-hidden="true"><span /><span /><span /></span>
      <div>
        <p class="bb-kicker">BlockBerry</p>
        <h3>{{ displayName }}</h3>
      </div>
    </header>

    <div v-if="loading" class="bb-state">Vorschau wird geladen …</div>
    <div v-else-if="error" class="bb-state error">{{ error }}</div>

    <template v-else>
      <div class="bb-preview-frame">
        <img
          v-if="previewImage"
          class="bb-preview-image"
          :src="previewImage"
          :alt="`Vorschau von ${displayName}`"
        />
        <div v-else class="bb-state subtle">Noch keine eingebettete Vorschau</div>
      </div>

      <dl class="bb-meta">
        <div>
          <dt>Blöcke</dt>
          <dd>{{ blockCountLabel }}</dd>
        </div>
        <div>
          <dt>Gespeichert</dt>
          <dd>{{ savedAtLabel }}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>.bbprj</dd>
        </div>
      </dl>

      <button class="bb-open" type="button" :disabled="!canOpen" @click="openInEditor">
        Im Editor öffnen
      </button>
    </template>
  </aside>
</template>

<script setup lang="ts">
import {computed, ref, unref, watch} from 'vue'
import type {Resource} from '@opencloud-eu/web-client'
import {useClientService, useRouter} from '@opencloud-eu/web-pkg'
import {BRAND} from '../brand'
import {isProjectFile, parseProject, stripKnownProjectExtension} from '../project'
import {placeholderPreview} from '../preview'
import {resolveSidebarSpace} from '../sidebarSpace'

const props = defineProps<{
  panelContext: Record<string, unknown>
}>()

const router = useRouter()
const {webdav} = useClientService()

const loading = ref(false)
const error = ref('')
const previewImage = ref('')
const blockCount = ref<number | null>(null)
const savedAt = ref('')
const projectName = ref('')

const selectedResource = computed<Resource | null>(() => {
  const items = unref(props.panelContext?.items as Resource[] | undefined)
  if (!Array.isArray(items) || items.length !== 1) return null
  return items[0] ?? null
})

const selectedSpace = computed(() => resolveSidebarSpace(props.panelContext))

const displayName = computed(
  () =>
    projectName.value ||
    stripKnownProjectExtension(selectedResource.value?.name) ||
    'BlockBerry Projekt',
)

const blockCountLabel = computed(() =>
  blockCount.value === null ? '—' : String(blockCount.value),
)

const savedAtLabel = computed(() => {
  if (!savedAt.value) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(savedAt.value))
  } catch {
    return savedAt.value
  }
})

const canOpen = computed(() => !!selectedResource.value && !!selectedSpace.value)

async function loadPreview(): Promise<void> {
  const resource = selectedResource.value
  const space = selectedSpace.value

  previewImage.value = ''
  blockCount.value = null
  savedAt.value = ''
  projectName.value = ''
  error.value = ''

  if (!resource || !space) {
    error.value = 'Keine Datei ausgewählt'
    return
  }

  if (resource.extension !== BRAND.extension && !resource.name?.endsWith(`.${BRAND.extension}`)) {
    error.value = 'Keine BlockBerry-Projektdatei'
    return
  }

  loading.value = true
  try {
    const response = await webdav.getFileContents(space, {
      path: resource.path,
    })
    const body = String(response?.body ?? '')

    if (!body.trim()) {
      const placeholder = placeholderPreview(stripKnownProjectExtension(resource.name))
      previewImage.value = placeholder.image
      blockCount.value = 0
      projectName.value = stripKnownProjectExtension(resource.name)
      return
    }

    const project = parseProject(body)
    if (!isProjectFile(project)) {
      throw new Error('Ungültiges Projektformat')
    }

    projectName.value = project.name || stripKnownProjectExtension(resource.name)
    savedAt.value = project.savedAt || ''
    blockCount.value = project.preview?.blockCount ?? null
    previewImage.value =
      project.preview?.image ||
      placeholderPreview(projectName.value, blockCount.value || 0).image
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Vorschau fehlgeschlagen'
  } finally {
    loading.value = false
  }
}

function openInEditor(): void {
  const resource = selectedResource.value
  const space = selectedSpace.value
  if (!resource || !space) return

  const driveAliasAndItem = space.getDriveAliasAndItem(resource)
  void router.push({
    name: 'blockberry-editor-file',
    params: {driveAliasAndItem},
    query: {
      ...(resource.fileId ? {fileId: resource.fileId} : {}),
    },
  })
}

watch(
  [selectedResource, selectedSpace],
  () => {
    void loadPreview()
  },
  {immediate: true},
)
</script>

<style scoped>
.bb-preview-panel {
  --berry: #d63b65;
  --mint: #80e6bc;
  --dark: #111a17;
  --paper: #f7f8f6;
  --line: #d6dcd8;
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  padding: 16px;
  color: #17211d;
  font-family: Manrope, system-ui, sans-serif;
  background:
    radial-gradient(120% 80% at 100% 0%, rgba(214, 59, 101, 0.12), transparent 55%),
    radial-gradient(90% 70% at 0% 100%, rgba(128, 230, 188, 0.16), transparent 50%),
    var(--paper);
}

.bb-preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bb-mark {
  display: grid;
  grid-template-columns: repeat(2, 9px);
  grid-template-rows: repeat(2, 9px);
  gap: 2px;
  width: 22px;
  transform: rotate(-4deg);
}

.bb-mark span {
  display: block;
  border-radius: 2.5px;
  background: var(--berry);
}

.bb-mark span:nth-child(2) {
  background: #ef6689;
}

.bb-mark span:nth-child(3) {
  grid-column: 1 / 3;
  width: 14px;
  margin-left: 3px;
  background: var(--mint);
}

.bb-kicker {
  margin: 0;
  color: #6d7b74;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.bb-preview-header h3 {
  margin: 2px 0 0;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.bb-preview-frame {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: #eef1ef;
  box-shadow: 0 10px 30px rgba(17, 26, 23, 0.08);
}

.bb-preview-image {
  display: block;
  width: 100%;
  height: auto;
}

.bb-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.bb-meta > div {
  padding: 10px 10px 8px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
}

.bb-meta dt {
  color: #6d7b74;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.bb-meta dd {
  margin: 4px 0 0;
  font-size: 13px;
  font-weight: 700;
}

.bb-open {
  margin-top: auto;
  padding: 12px 14px;
  color: #fff;
  font: inherit;
  font-weight: 800;
  letter-spacing: -0.02em;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--berry), #b91c48);
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(214, 59, 101, 0.28);
}

.bb-open:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  box-shadow: none;
}

.bb-state {
  display: grid;
  place-items: center;
  min-height: 120px;
  padding: 16px;
  color: #5b6962;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  border: 1px dashed var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.55);
}

.bb-state.error {
  color: #b42318;
  border-color: #f3b4b0;
  background: #fff5f4;
}

.bb-state.subtle {
  min-height: 160px;
}
</style>
