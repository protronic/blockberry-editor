<template>
  <nav class="repl-toolbar" aria-label="REPL-Aktionen">
    <div class="repl-link" role="radiogroup" aria-label="Verbindungstyp">
      <button
        class="repl-tool"
        type="button"
        role="radio"
        :aria-checked="replLink === 'ble'"
        :disabled="bleConnecting || bleConnected"
        title="Web Bluetooth (BLE / NUS)"
        aria-label="Web Bluetooth"
        @click="onLink('ble')"
      >
        <AppIcon name="ble" />
      </button>
      <button
        class="repl-tool"
        type="button"
        role="radio"
        :aria-checked="replLink === 'serial'"
        :disabled="bleConnecting || bleConnected"
        title="Web Serial (USB-CDC)"
        aria-label="Web Serial USB-CDC"
        @click="onLink('serial')"
      >
        <AppIcon name="usb" />
      </button>
    </div>
    <button
      class="repl-tool"
      type="button"
      :class="{online: bleConnected, primary: !bleConnected}"
      :disabled="bleConnecting || (!supported && !bleConnected)"
      :title="connectLabel"
      :aria-label="connectLabel"
      @click="onConnect"
    >
      <AppIcon :name="replLink === 'serial' ? 'usb' : 'ble'" />
      <span class="repl-dot" :data-state="status" />
    </button>
    <button
      class="repl-tool primary"
      type="button"
      :disabled="!canSend"
      :title="sendTitle"
      :aria-label="sendTitle"
      @click="onSend"
    >
      <AppIcon :name="replLink === 'serial' ? 'upload-usb' : 'upload-ble'" />
    </button>
    <button
      class="repl-tool"
      type="button"
      :disabled="!bleLog"
      title="Log leeren"
      aria-label="Log leeren"
      @click="clearBleLog"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"
        />
      </svg>
    </button>
  </nav>
</template>

<script setup lang="ts">
import {computed} from 'vue'
import {
  bleConnected,
  bleConnecting,
  bleLog,
  bleSending,
  clearBleLog,
  connectBle,
  currentLinkSupported,
  currentScript,
  disconnectBle,
  replLink,
  sendCurrentScript,
  setReplLink,
  type ReplLink,
} from '../ble/session'
import AppIcon from './AppIcon.vue'

const supported = computed(() => currentLinkSupported())
const scriptReady = computed(() => currentScript.value.trim().length > 0)
const canSend = computed(() => bleConnected.value && scriptReady.value && !bleSending.value)
const status = computed(() => {
  if (!supported.value) return 'unsupported'
  if (bleConnecting.value) return 'connecting'
  if (bleConnected.value) return 'online'
  return 'offline'
})
const connectLabel = computed(() => {
  if (bleConnecting.value) return 'Verbinden …'
  if (bleConnected.value) return 'Trennen'
  return replLink.value === 'serial' ? 'USB-Gerät verbinden' : 'BLE-Gerät verbinden'
})
const sendTitle = computed(() => {
  if (!scriptReady.value) return 'Kein Editor-Skript'
  if (!bleConnected.value) return 'Zuerst Gerät verbinden'
  return replLink.value === 'serial' ? 'Skript per USB-CDC senden' : 'Skript per BLE senden'
})

function onLink(kind: ReplLink): void {
  setReplLink(kind)
}

function onConnect(): void {
  if (bleConnected.value) disconnectBle()
  else void connectBle()
}

function onSend(): void {
  void sendCurrentScript()
}
</script>

<style scoped>
.repl-toolbar {
  display: flex;
  align-items: center;
  gap: 7px;
}

.repl-link {
  display: flex;
  gap: 0;
  border: 1px solid #34413c;
  border-radius: 5px;
  overflow: hidden;
}

.repl-link .repl-tool {
  width: 30px;
  height: 32px;
  border: 0;
  border-radius: 0;
}

.repl-link .repl-tool + .repl-tool {
  border-left: 1px solid #34413c;
}

.repl-link .repl-tool[aria-checked='true'] {
  color: #80e6bc;
  background: #1b2c27;
}

.repl-tool {
  position: relative;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  color: #aebbb5;
  background: transparent;
  border: 1px solid #34413c;
  border-radius: 5px;
}

.repl-tool:hover:enabled {
  color: #fff;
  background: #202c27;
}

.repl-tool:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.repl-tool.primary {
  width: auto;
  min-width: 34px;
  padding: 0 8px;
  color: #fff;
  background: #d63b65;
  border-color: transparent;
}

.repl-tool.primary:hover:enabled {
  background: #e24670;
}

.repl-tool.online {
  color: #80e6bc;
  border-color: #2f5a48;
}

.repl-tool :deep(svg) {
  width: 16px;
  height: 16px;
}

.repl-tool :deep(.icon-pair svg) {
  width: 14px;
  height: 14px;
}

.repl-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #6b7a74;
  box-shadow: 0 0 0 2px #111a17;
}

.repl-dot[data-state='online'] {
  background: #80e6bc;
}

.repl-dot[data-state='connecting'] {
  background: #efd27a;
}

.repl-dot[data-state='unsupported'] {
  background: #c42e56;
}
</style>
