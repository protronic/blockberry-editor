<template>
  <span v-if="name === 'upload-ble'" class="icon-pair" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <path fill="currentColor" :d="upload" />
    </svg>
    <svg viewBox="0 0 24 24">
      <path fill="currentColor" :d="ble" />
    </svg>
  </span>
  <svg v-else :viewBox="box" aria-hidden="true">
    <path fill="currentColor" :d="path" />
  </svg>
</template>

<script setup lang="ts">
import {computed} from 'vue'

const ble =
  'M17.71 7.71 12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29ZM13 5.83l1.88 1.88L13 9.59V5.83Zm1.88 10.46L13 18.17v-3.76l1.88 1.88Z'
const upload = 'M5 20h14v-2H5v2Zm7-18-7 7h4v6h6v-6h4l-7-7Z'
const blocks =
  'M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM7 13h10v3H7v-3ZM3 18h18v3H3v-3Z'
const editor =
  'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM7 13h10v8H7v-8Z'
const menu = 'M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z'

const paths = {ble, upload, blocks, editor, menu} as const

const props = defineProps<{
  name: 'ble' | 'upload' | 'upload-ble' | 'blocks' | 'editor' | 'menu'
}>()

const path = computed(() => (props.name === 'upload-ble' ? '' : paths[props.name]))
const box = '0 0 24 24'
</script>

<style scoped>
svg {
  display: block;
  width: 1em;
  height: 1em;
}

.icon-pair {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.icon-pair svg {
  width: 0.92em;
  height: 0.92em;
}
</style>
