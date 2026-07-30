<template>
  <div class="app-shell blockberry-app">
    <header class="topbar">
      <div class="brand" aria-label="BlockBerry Editor">
        <span class="brand-mark" aria-hidden="true"><span /><span /><span /></span>
        <span class="brand-name">Block<span>Berry</span></span>
        <span class="brand-tag">OpenCloud</span>
      </div>

      <label class="project-name">
        <span>Projekt</span>
        <input
          v-model="projectName"
          :disabled="isReadOnly"
          maxlength="64"
          @input="scheduleUpdate"
        />
      </label>

      <nav class="top-actions" aria-label="Projektaktionen">
        <button
          class="button ghost"
          type="button"
          :disabled="isReadOnly"
          @click="resetProject"
        >
          Zurücksetzen
        </button>
        <button class="button secondary" type="button" @click="exportScript">
          .be exportieren
        </button>
      </nav>
    </header>

    <main class="workspace-layout">
      <section class="editor-panel" aria-label="Blockly-Editor">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">Ablaufsteuerung</span>
            <h1>Visueller Programmablauf</h1>
          </div>
          <div class="editor-tools">
            <span class="autosave-state">
              <span />
              {{ isReadOnly ? 'Schreibgeschützt' : 'OpenCloud-Speicherung aktiv' }}
            </span>
            <button class="icon-button" type="button" @click="centerWorkspace">
              Zentrieren
            </button>
          </div>
        </div>
        <div ref="editorElement" class="blockly-editor" />
      </section>

      <aside class="code-panel" aria-label="Berry-Codevorschau">
        <div class="code-heading">
          <div>
            <span class="eyebrow mint">Live-Vorschau</span>
            <h2>.be Script</h2>
          </div>
          <button class="icon-button dark" type="button" @click="copyCode">Kopieren</button>
        </div>

        <div class="runtime-badge">
          <span class="pulse" />
          <div>
            <strong>Berry-Textvorschau</strong>
            <small>sps · escalation · thingsboard · od · canopen · ui</small>
          </div>
        </div>

        <div class="code-wrap">
          <pre><code>{{ generatedCode }}</code></pre>
        </div>

        <div class="code-stats">
          <span><strong>{{ lineCount }}</strong> Zeilen</span>
          <span><strong>{{ byteCount }}</strong> Bytes</span>
          <span class="syntax-ok"><i /> Generator bereit</span>
        </div>
      </aside>
    </main>

    <footer class="statusbar">
      <span><i class="status-ready" /> BlockBerry bereit</span>
      <span>JSON-Projekt → Blockly → Berry</span>
      <span>{{ blockCount }} Blöcke</span>
    </footer>

    <div ref="toastElement" class="toast" role="status" aria-live="polite" />
  </div>
</template>

<script setup lang="ts">
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as De from 'blockly/msg/de';
import type {Resource} from '@opencloud-eu/web-client';
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {
  berryGenerator,
  blockBerryToolbox,
  registerBlockBerryBlocks,
} from './library';

type ProjectFile = {
  format: 'blockberry';
  version: 1;
  name: string;
  savedAt: string;
  workspace: object;
};

const props = withDefaults(
  defineProps<{
    currentContent: string;
    isReadOnly?: boolean;
    resource: Resource;
  }>(),
  {isReadOnly: false},
);

const emit = defineEmits<{
  (event: 'update:currentContent', value: string): void;
}>();

const editorElement = ref<HTMLElement>();
const toastElement = ref<HTMLElement>();
const projectName = ref('Neue Steuerung');
const generatedCode = ref('# Generator wird initialisiert …');
const blockCount = ref(0);
const workspace = ref<Blockly.WorkspaceSvg>();
let updateTimer = 0;
let toastTimer = 0;
let resizeObserver: ResizeObserver | undefined;
let lastContent = '';

const lineCount = computed(() => {
  const code = generatedCode.value.trimEnd();
  return code ? code.split('\n').length : 0;
});
const byteCount = computed(() => new TextEncoder().encode(generatedCode.value).length);

const starterXml = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="mini_sps_task" x="48" y="48">
    <field name="NAME">anlagenstatus</field>
    <field name="INTERVAL">500</field>
    <statement name="LOOP">
      <block type="monitor_value">
        <field name="METRIC">prozesswert</field>
        <field name="UNIT">%</field>
        <value name="VALUE">
          <block type="od_read">
            <field name="INDEX">0x2000</field>
            <field name="SUBINDEX">0</field>
          </block>
        </value>
      </block>
    </statement>
  </block>
</xml>`;

function projectState(): ProjectFile {
  return {
    format: 'blockberry',
    version: 1,
    name: projectName.value.trim() || 'Unbenanntes Projekt',
    savedAt: new Date().toISOString(),
    workspace: Blockly.serialization.workspaces.save(workspace.value!),
  };
}

function parseProject(content: string): ProjectFile {
  const project = JSON.parse(content) as Partial<ProjectFile>;
  if (project.format !== 'blockberry' || project.version !== 1 || !project.workspace) {
    throw new Error('Keine gültige BlockBerry-Projektdatei');
  }
  return project as ProjectFile;
}

function updateOutput(): void {
  if (!workspace.value) return;
  try {
    generatedCode.value = berryGenerator.workspaceToCode(workspace.value);
    blockCount.value = workspace.value.getAllBlocks(false).length;
    const serialized = JSON.stringify(projectState(), null, 2);
    if (!props.isReadOnly && serialized !== lastContent) {
      lastContent = serialized;
      emit('update:currentContent', serialized);
    }
  } catch (error) {
    generatedCode.value = `# Generatorfehler\n# ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

function scheduleUpdate(): void {
  window.clearTimeout(updateTimer);
  updateTimer = window.setTimeout(updateOutput, 90);
}

function loadStarter(): void {
  if (!workspace.value) return;
  workspace.value.clear();
  Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(starterXml), workspace.value);
  window.setTimeout(() => workspace.value?.zoomToFit(), 30);
  updateOutput();
}

function loadContent(content: string): void {
  if (!workspace.value) return;
  if (!content.trim()) {
    projectName.value = props.resource?.name?.replace(/\.blockberry\.json$|\.json$/i, '') ||
      'Neue Steuerung';
    loadStarter();
    return;
  }

  const project = parseProject(content);
  workspace.value.clear();
  Blockly.serialization.workspaces.load(project.workspace, workspace.value);
  projectName.value = project.name || 'Unbenanntes Projekt';
  lastContent = content;
  updateOutput();
  window.setTimeout(() => workspace.value?.zoomToFit(), 30);
}

function resetProject(): void {
  if (props.isReadOnly || !window.confirm('Aktuelles Projekt zurücksetzen?')) return;
  projectName.value = 'Neue Steuerung';
  loadStarter();
}

function centerWorkspace(): void {
  workspace.value?.zoomToFit();
}

function safeScriptName(): string {
  const base = projectName.value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß_-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'blockberry'}.be`;
}

function exportScript(): void {
  updateOutput();
  const url = URL.createObjectURL(
    new Blob([generatedCode.value], {type: 'text/plain;charset=utf-8'}),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeScriptName();
  anchor.click();
  URL.revokeObjectURL(url);
}

async function copyCode(): Promise<void> {
  await navigator.clipboard.writeText(generatedCode.value);
  if (!toastElement.value) return;
  window.clearTimeout(toastTimer);
  toastElement.value.textContent = 'Berry-Code kopiert';
  toastElement.value.classList.add('visible');
  toastTimer = window.setTimeout(() => toastElement.value?.classList.remove('visible'), 2200);
}

watch(
  () => props.currentContent,
  (content) => {
    if (workspace.value && content !== lastContent) loadContent(content);
  },
);

onMounted(async () => {
  Blockly.setLocale(De as unknown as Record<string, string>);
  registerBlockBerryBlocks();
  await nextTick();
  workspace.value = Blockly.inject(editorElement.value!, {
    toolbox: props.isReadOnly ? undefined : blockBerryToolbox,
    readOnly: props.isReadOnly,
    renderer: 'zelos',
    trashcan: !props.isReadOnly,
    sounds: false,
    move: {scrollbars: true, drag: true, wheel: true},
    zoom: {
      controls: true,
      wheel: true,
      startScale: 0.86,
      maxScale: 1.5,
      minScale: 0.4,
      scaleSpeed: 1.1,
    },
    grid: {spacing: 24, length: 2, colour: '#d9dfdc', snap: true},
  });
  workspace.value.addChangeListener((event) => {
    if (!event.isUiEvent) scheduleUpdate();
  });
  resizeObserver = new ResizeObserver(() => Blockly.svgResize(workspace.value!));
  resizeObserver.observe(editorElement.value!);

  try {
    loadContent(props.currentContent || '');
  } catch (error) {
    generatedCode.value = `# Projekt konnte nicht geladen werden\n# ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
});

onBeforeUnmount(() => {
  window.clearTimeout(updateTimer);
  window.clearTimeout(toastTimer);
  resizeObserver?.disconnect();
  workspace.value?.dispose();
});
</script>

<style scoped src="../web/styles.css"></style>
<style scoped>
.blockberry-app {
  --ink: #17211d;
  --dark: #111a17;
  --berry: #d63b65;
  --mint: #80e6bc;
  --line: #d6dcd8;
  --paper: #f7f8f6;
  width: 100%;
  height: 100%;
  min-height: 0;
  color: var(--ink);
  font-family: 'Manrope', system-ui, sans-serif;
  background: #e8ece9;
}

.blockly-editor {
  width: 100%;
  height: 100%;
}

button:disabled,
input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
