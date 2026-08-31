<template>
  <div class="ble-repl" :class="{'is-embedded': embedded}">
    <header v-if="!embedded" class="ble-topbar">
      <div class="ble-brand" aria-label="REPL">
        <span class="ble-mark" aria-hidden="true"><span /><span /><span /></span>
        <div>
          <strong>REPL</strong>
          <small>{{
            replLink === 'serial' ? 'Web Serial · USB-CDC' : 'Web Bluetooth · NUS'
          }}</small>
        </div>
      </div>
      <ViewSwitch
        current="repl"
        :editor-enabled="!!editorReturn"
        @change="onViewChange"
      />
      <span class="ble-status" :data-state="status">{{ statusLabel }}</span>
      <ReplMenu />
    </header>

    <p v-if="!supported" class="ble-banner warn">{{ unsupportedHint }}</p>
    <p v-else-if="bleError" class="ble-banner error">{{ bleError }}</p>
    <p v-else-if="scriptReady" class="ble-banner script">
      Aktuelles Skript: <strong>{{ scriptLabel }}</strong>
      · {{ scriptLines }} Zeilen — Upload in die Eingabe oder an das Gerät senden.
    </p>

    <main ref="logElement" class="ble-log" aria-label="REPL-Ausgabe">
      <pre v-if="bleLog">{{ bleLog }}</pre>
      <p v-else class="ble-empty">{{ emptyHint }}</p>
    </main>

    <form class="ble-input" @submit.prevent="sendLine">
      <span class="ble-prompt" aria-hidden="true">{{ bleConnected ? '>' : '·' }}</span>
      <textarea
        v-model="line"
        rows="1"
        autocomplete="off"
        spellcheck="false"
        :disabled="!bleConnected"
        :placeholder="
          bleConnected
            ? 'Berry-Zeile oder Skript, Enter zum Senden'
            : replLink === 'serial'
              ? 'Zuerst USB-Gerät verbinden'
              : 'Zuerst BLE-Gerät verbinden'
        "
        @keydown="onInputKey"
      />
      <button
        class="ble-btn icon"
        type="button"
        :disabled="!scriptReady"
        title="Skript in die Eingabe laden"
        aria-label="Skript in die Eingabe laden"
        @click="loadScriptToDraft"
      >
        <AppIcon name="upload" />
      </button>
      <button class="ble-btn primary" type="submit" :disabled="!bleConnected || !line.trim()">
        Senden
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import {useRouter} from '@opencloud-eu/web-pkg'
import {
  bleConnected,
  bleConnecting,
  bleError,
  bleLog,
  bleName,
  currentLinkSupported,
  currentScript,
  currentScriptName,
  editorReturn,
  loadScriptToDraft,
  releaseBle,
  retainBle,
  replDraft,
  replLink,
  scriptLineCount,
  sendText,
  type AppView,
} from '../ble/session'
import ReplMenu from '../components/ReplMenu.vue'
import AppIcon from '../components/AppIcon.vue'
import ViewSwitch from '../components/ViewSwitch.vue'

const props = withDefaults(
  defineProps<{
    embedded?: boolean
    script?: string
    scriptName?: string
  }>(),
  {embedded: false, script: '', scriptName: ''},
)

const router = useRouter()
const supported = computed(() => currentLinkSupported())
const line = ref('')
const logElement = ref<HTMLElement>()
const history: string[] = []
let historyIndex = -1

const status = computed(() => {
  if (!supported.value) return 'unsupported'
  if (bleConnecting.value) return 'connecting'
  if (bleConnected.value) return 'online'
  return 'offline'
})

const statusLabel = computed(() => {
  if (status.value === 'unsupported') {
    return replLink.value === 'serial' ? 'Kein Web Serial' : 'Kein Web Bluetooth'
  }
  if (status.value === 'connecting') return 'Verbinden …'
  if (status.value === 'online') return bleName.value || 'Verbunden'
  return 'Getrennt'
})

const unsupportedHint = computed(() =>
  replLink.value === 'serial'
    ? 'Web Serial braucht Chrome oder Edge über HTTPS. Firefox unterstützt die API nicht.'
    : 'Web Bluetooth braucht Chrome oder Edge über HTTPS. Firefox unterstützt die API nicht.',
)

const emptyHint = computed(() =>
  replLink.value === 'serial'
    ? 'USB-Gerät wählen. Das Board erscheint als serieller Port (USB-CDC). Das aktuelle BlockBerry-Skript lässt sich laden und zeilenweise an die REPL senden.'
    : 'Mit einem BLEberry-Board verbinden. Das aktuelle BlockBerry-Skript lässt sich laden und zeilenweise an die REPL senden.',
)

const scriptReady = computed(() => currentScript.value.trim().length > 0)
const scriptLabel = computed(() => currentScriptName.value || 'script.be')
const scriptLines = computed(() => scriptLineCount())

watch(
  () => [props.script, props.scriptName] as const,
  ([code, name]) => {
    if (code) {
      currentScript.value = code
      if (name) currentScriptName.value = name
    }
  },
  {immediate: true},
)

watch(replDraft, (draft) => {
  if (!draft) return
  line.value = draft
  replDraft.value = ''
})

watch(bleLog, async () => {
  await nextTick()
  const el = logElement.value
  if (el) el.scrollTop = el.scrollHeight
})

async function sendLine(): Promise<void> {
  const text = line.value
  if (!bleConnected.value || !text.trim()) return
  history.push(text)
  historyIndex = history.length
  line.value = ''
  const payload = text.endsWith('\n') ? text : `${text}\n`
  bleLog.value += payload
  try {
    await sendText(payload)
  } catch (sendError) {
    bleError.value = sendError instanceof Error ? sendError.message : String(sendError)
  }
}

function onInputKey(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void sendLine()
    return
  }
  if (event.key === 'ArrowUp' && !line.value.includes('\n')) {
    event.preventDefault()
    if (!history.length) return
    historyIndex = Math.max(0, historyIndex - 1)
    line.value = history[historyIndex] ?? ''
  } else if (event.key === 'ArrowDown' && !line.value.includes('\n')) {
    event.preventDefault()
    historyIndex = Math.min(history.length, historyIndex + 1)
    line.value = history[historyIndex] ?? ''
  }
}

function onViewChange(view: AppView): void {
  if (view !== 'editor' || !editorReturn.value) return
  void router.push(editorReturn.value)
}

onMounted(() => retainBle())
onBeforeUnmount(() => releaseBle())
</script>

<style scoped>
.ble-repl {
  --ink: #17211d;
  --dark: #111a17;
  --berry: #d63b65;
  --mint: #80e6bc;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  color: var(--ink);
  font-family: 'Manrope', system-ui, sans-serif;
  background: #e8ece9;
}

.ble-repl.is-embedded {
  background: #0f1613;
}

.ble-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 0 18px;
  min-height: 56px;
  color: #fff;
  background: var(--dark);
  border-bottom: 1px solid #2b3732;
}

.ble-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ble-brand strong {
  display: block;
  font-size: 15px;
  letter-spacing: -0.3px;
}

.ble-brand small {
  color: #aebbb5;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ble-mark {
  display: grid;
  grid-template-columns: repeat(2, 8px);
  grid-template-rows: repeat(2, 8px);
  gap: 2px;
  transform: rotate(-3deg);
}

.ble-mark span {
  display: block;
  border-radius: 2px;
  background: var(--berry);
}

.ble-mark span:nth-child(2) {
  background: #ef7996;
}

.ble-mark span:nth-child(3) {
  grid-column: 1 / 3;
  width: 12px;
  margin-left: 3px;
  background: var(--mint);
}

.ble-status {
  margin-left: auto;
  padding: 4px 8px;
  color: #aebbb5;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid #394640;
  border-radius: 999px;
}

.ble-status[data-state='online'] {
  color: var(--mint);
  border-color: #2f5a48;
}

.ble-status[data-state='connecting'] {
  color: #efd27a;
}

.ble-btn {
  min-height: 32px;
  padding: 0 12px;
  color: #e7eeea;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid transparent;
  border-radius: 5px;
  cursor: pointer;
}

.ble-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.ble-btn.ghost {
  background: transparent;
  border-color: #34413c;
}

.ble-btn.ghost:hover:enabled {
  background: #202c27;
}

.ble-btn.primary {
  color: #fff;
  background: var(--berry);
}

.ble-btn.primary:hover:enabled {
  background: #e24670;
}

.ble-banner {
  margin: 0;
  padding: 8px 18px;
  font-size: 12px;
}

.ble-banner.warn {
  background: #f4ecd0;
  color: #6a5414;
}

.ble-banner.error {
  background: #fdecea;
  color: #8c1d18;
}

.ble-banner.script {
  background: #1d2a25;
  color: #c5d4cc;
}

.ble-banner.script strong {
  color: var(--mint);
}

.ble-log {
  flex: 1 1 auto;
  min-height: 0;
  padding: 16px 18px;
  overflow: auto;
  background: #0f1613;
  color: #d7eee4;
  font-family: 'DM Mono', ui-monospace, Consolas, monospace;
  font-size: 13px;
  line-height: 1.45;
}

.ble-log pre {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.ble-empty {
  margin: 0;
  color: #7b8c84;
  max-width: 42em;
}

.ble-input {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 14px;
  background: #1a2420;
  border-top: 1px solid #2b3732;
}

.ble-prompt {
  color: var(--mint);
  font-family: 'DM Mono', ui-monospace, Consolas, monospace;
  font-size: 16px;
  font-weight: 700;
  padding-bottom: 8px;
}

.ble-input textarea {
  flex: 1;
  min-width: 0;
  min-height: 38px;
  max-height: 160px;
  padding: 8px 10px;
  color: #edf3ef;
  font: inherit;
  font-family: 'DM Mono', ui-monospace, Consolas, monospace;
  font-size: 13px;
  line-height: 1.4;
  background: #111a17;
  border: 1px solid #34413c;
  border-radius: 5px;
  outline: none;
  resize: vertical;
}

.ble-input textarea:focus {
  border-color: var(--berry);
}

.ble-btn.icon {
  display: grid;
  place-items: center;
  width: 38px;
  padding: 0;
  background: transparent;
  border-color: #34413c;
}

.ble-btn.icon:hover:enabled {
  background: #202c27;
}

.ble-btn.icon :deep(svg) {
  width: 16px;
  height: 16px;
}
</style>
