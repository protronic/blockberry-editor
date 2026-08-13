import {computed, ref, shallowRef} from 'vue'
import type {LocationQuery, RouteParams} from 'vue-router'
import {bluetoothSupported, connectNus, type NusSession} from './nus'

export type AppView = 'editor' | 'repl'

export const currentScript = ref('')
export const currentScriptName = ref('')

export const editorReturn = ref<{
  name: string
  params: RouteParams
  query: LocationQuery
} | null>(null)

const session = shallowRef<NusSession | null>(null)
export const bleLog = ref('')
export const bleConnecting = ref(false)
export const bleError = ref('')
export const bleSending = ref(false)
export const bleName = computed(() => session.value?.name ?? '')
export const bleConnected = computed(() => !!session.value)

let retainCount = 0

export function scriptLineCount(code = currentScript.value): number {
  const text = code.trimEnd()
  return text ? text.split('\n').length : 0
}

export function publishScript(code: string, name = ''): void {
  currentScript.value = code
  if (name) currentScriptName.value = name
}

export const replDraft = ref('')

export function loadScriptToDraft(): void {
  replDraft.value = currentScript.value.replace(/\r\n/g, '\n').trimEnd()
}

export function rememberEditor(route: {
  name?: string | symbol | null
  params: RouteParams
  query: LocationQuery
}): void {
  if (typeof route.name !== 'string' || route.name === 'blockberry-editor-repl') return
  editorReturn.value = {
    name: route.name,
    params: {...route.params},
    query: {...route.query},
  }
}

export function appendBleLog(text: string): void {
  bleLog.value += text
}

export function clearBleLog(): void {
  bleLog.value = ''
}

export function retainBle(): void {
  retainCount += 1
}

export function releaseBle(): void {
  retainCount = Math.max(0, retainCount - 1)
  if (retainCount === 0) disconnectBle()
}

export async function connectBle(): Promise<void> {
  if (!bluetoothSupported() || bleConnecting.value || session.value) return
  bleError.value = ''
  bleConnecting.value = true
  try {
    const next = await connectNus({
      onRx: (text) => appendBleLog(text),
      onDisconnect: () => {
        session.value = null
        appendBleLog('\n— getrennt —\n')
      },
    })
    session.value = next
    appendBleLog(`— verbunden mit ${next.name} —\n`)
  } catch (connectError) {
    const message =
      connectError instanceof Error ? connectError.message : String(connectError)
    if (!/cancell?ed/i.test(message)) {
      bleError.value = `Verbindung fehlgeschlagen: ${message}`
    }
  } finally {
    bleConnecting.value = false
  }
}

export function disconnectBle(): void {
  session.value?.disconnect()
  session.value = null
}

export async function sendText(text: string): Promise<void> {
  if (!session.value) throw new Error('Nicht verbunden')
  await session.value.send(text)
}

export async function sendCurrentScript(): Promise<void> {
  const body = currentScript.value.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trimEnd()
  if (!body) throw new Error('Kein Skript zum Senden')
  if (!session.value) throw new Error('Nicht verbunden')
  bleSending.value = true
  bleError.value = ''
  try {
    const lines = scriptLineCount(body)
    const label = currentScriptName.value || 'script.be'
    appendBleLog(`— sende ${label} (${lines} Zeilen) —\n`)
    await sendText(`${body}\n`)
  } catch (sendError) {
    bleError.value = sendError instanceof Error ? sendError.message : String(sendError)
    throw sendError
  } finally {
    bleSending.value = false
  }
}
