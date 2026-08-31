<template>
  <div class="view-switch" role="tablist" aria-label="Ansicht">
    <button
      type="button"
      role="tab"
      :aria-selected="current === 'editor'"
      :disabled="!editorEnabled"
      title="Editor"
      aria-label="Editor"
      @click="emit('change', 'editor')"
    >
      <AppIcon name="editor" />
    </button>
    <button
      type="button"
      role="tab"
      :aria-selected="current === 'repl'"
      title="REPL"
      aria-label="REPL"
      @click="emit('change', 'repl')"
    >
      <AppIcon name="ble" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type {AppView} from '../ble/session'
import AppIcon from './AppIcon.vue'

withDefaults(
  defineProps<{
    current: AppView
    editorEnabled?: boolean
  }>(),
  {editorEnabled: true},
)

const emit = defineEmits<{
  change: [view: AppView]
}>()
</script>

<style scoped>
.view-switch {
  display: flex;
  flex: 0 0 auto;
  padding: 3px;
  background: #1b2722;
  border: 1px solid #34413c;
  border-radius: 7px;
}

.view-switch button {
  display: grid;
  place-items: center;
  width: 32px;
  min-height: 28px;
  padding: 0;
  color: #aebbb5;
  font: inherit;
  background: transparent;
  border: 0;
  border-radius: 5px;
}

.view-switch button :deep(svg) {
  width: 16px;
  height: 16px;
}

.view-switch button[aria-selected='true'] {
  color: #fff;
  background: #d63b65;
}

.view-switch button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.view-switch button:not(:disabled):hover {
  color: #fff;
}
</style>
