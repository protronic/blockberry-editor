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

      <label class="device-profile">
        <span>Gerät</span>
        <select
          v-model="selectedProfileId"
          :disabled="isReadOnly"
          aria-label="Geräteprofil"
          @change="onDeviceProfileChange"
        >
          <option value="">Alle Blöcke</option>
          <option v-for="profile in profileOptions" :key="profile.id" :value="profile.id">
            {{ profile.name }}
          </option>
        </select>
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
import {useAuthStore} from '@opencloud-eu/web-pkg';
import {computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch} from 'vue';
import {
  configureCouchAuth,
  listCloudProfiles,
} from '../web/couch';
import {
  berryGenerator,
  bundledDeviceProfiles,
  deviceProfiles,
  refreshSpsChannelFields,
  registerBlockBerryBlocks,
  setActiveDeviceProfile,
  setDeviceProfiles,
  toolboxForProfile,
  type DeviceProfile,
} from './library';

type ProjectFile = {
  format: 'blockberry';
  version: 1;
  name: string;
  savedAt: string;
  workspace: object;
  /** Optional device profile id (e.g. pico_telemetry). */
  deviceProfile?: string;
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

const authStore = useAuthStore();
configureCouchAuth(async () => {
  const token = authStore.accessToken;
  if (!token) {
    throw new Error('Kein OpenCloud Access Token — bitte in OpenCloud anmelden');
  }
  return token;
});

const editorElement = ref<HTMLElement>();
const toastElement = ref<HTMLElement>();
const projectName = ref('Neue Steuerung');
const selectedProfileId = ref('');
const profileOptions = ref<DeviceProfile[]>([]);
const generatedCode = ref('# Generator wird initialisiert …');
const blockCount = ref(0);
// Blockly relies on identity comparisons in its internal data structures
// (e.g. the connection database). A deep `ref` would wrap the workspace in a
// reactive proxy and corrupt those lookups, so loads abort halfway through.
const workspace = shallowRef<Blockly.WorkspaceSvg>();
let updateTimer = 0;
let toastTimer = 0;
let resizeObserver: ResizeObserver | undefined;
let lastContent = '';
let suppressAutosave = false;
let hasAppliedContent = false;
let contentLoadFailed = false;

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
    <statement name="INIT">
      <block type="signal_set">
        <field name="SIGNAL">statusleuchte</field>
        <field name="STATE">normal</field>
      </block>
    </statement>
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
        <next>
          <block type="escalation_rule">
            <field name="LEVEL">warning</field>
            <field name="COOLDOWN">60</field>
            <value name="CONDITION">
              <block type="sps_digital_input">
                <field name="CHANNEL">DI_ALARM</field>
              </block>
            </value>
            <value name="MESSAGE">
              <block type="text">
                <field name="TEXT">Grenzwert überschritten</field>
              </block>
            </value>
            <statement name="ON_TRIGGER">
              <block type="signal_set">
                <field name="SIGNAL">statusleuchte</field>
                <field name="STATE">warning</field>
                <next>
                  <block type="lvgl_set_text">
                    <field name="WIDGET">status_label</field>
                    <value name="TEXT">
                      <block type="text">
                        <field name="TEXT">WARNUNG</field>
                      </block>
                    </value>
                  </block>
                </next>
              </block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>`;

function resourceExpectsFileContent(resource: Resource | undefined): boolean {
  const size = Number(resource?.size ?? 0);
  return Number.isFinite(size) && size > 0;
}

function projectState(): ProjectFile {
  const profileId = selectedProfileId.value.trim();
  return {
    format: 'blockberry',
    version: 1,
    name: projectName.value.trim() || 'Unbenanntes Projekt',
    savedAt: new Date().toISOString(),
    workspace: Blockly.serialization.workspaces.save(workspace.value!),
    ...(profileId ? {deviceProfile: profileId} : {}),
  };
}

function syncProfileOptions(): void {
  profileOptions.value = [...deviceProfiles];
}

function applyDeviceProfile(profileId: string, announce = false): void {
  selectedProfileId.value = profileId;
  setActiveDeviceProfile(profileId || null);
  if (!workspace.value) return;
  workspace.value.updateToolbox(
    props.isReadOnly ? undefined : toolboxForProfile(profileId || null),
  );
  refreshSpsChannelFields(workspace.value);
  if (announce) {
    const profile = deviceProfiles.find((entry) => entry.id === profileId);
    showToast(profile ? `Profil: ${profile.name}` : 'Alle Blöcke');
  }
}

function onDeviceProfileChange(): void {
  applyDeviceProfile(selectedProfileId.value, true);
  scheduleUpdate();
}

function showToast(message: string): void {
  if (!toastElement.value) return;
  window.clearTimeout(toastTimer);
  toastElement.value.textContent = message;
  toastElement.value.classList.add('visible');
  toastTimer = window.setTimeout(() => toastElement.value?.classList.remove('visible'), 2200);
}

async function loadDeviceProfilesFromCouch(): Promise<void> {
  setDeviceProfiles(bundledDeviceProfiles());
  syncProfileOptions();

  if (!authStore.accessToken) {
    console.warn('OpenCloud Access Token fehlt — Couch-Profile übersprungen');
    return;
  }

  try {
    const profiles = await listCloudProfiles();
    if (!profiles.length) return;
    setDeviceProfiles(profiles);
    syncProfileOptions();
    if (
      selectedProfileId.value &&
      !profiles.some((profile) => profile.id === selectedProfileId.value)
    ) {
      applyDeviceProfile('');
    } else {
      applyDeviceProfile(selectedProfileId.value);
    }
  } catch (error) {
    console.warn('Cloud device profiles unavailable, using bundled fallback', error);
  }
}

function parseProject(content: string): ProjectFile {
  const project = JSON.parse(content) as Partial<ProjectFile>;
  if (project.format !== 'blockberry' || project.version !== 1 || !project.workspace) {
    throw new Error('Keine gültige BlockBerry-Projektdatei');
  }
  return project as ProjectFile;
}

function refreshPreview(): void {
  if (!workspace.value) return;
  try {
    generatedCode.value = berryGenerator.workspaceToCode(workspace.value);
    blockCount.value = workspace.value.getAllBlocks(false).length;
  } catch (error) {
    generatedCode.value = `# Generatorfehler\n# ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

function projectSignature(project: Partial<ProjectFile>): string {
  return JSON.stringify({name: project.name, workspace: project.workspace});
}

function commitWorkspaceToOpenCloud(): void {
  // contentLoadFailed guards against overwriting the stored file with a
  // partially applied workspace after a failed load.
  if (!workspace.value || props.isReadOnly || suppressAutosave || contentLoadFailed) return;
  refreshPreview();
  const state = projectState();
  if (lastContent) {
    try {
      if (projectSignature(JSON.parse(lastContent) as Partial<ProjectFile>) === projectSignature(state)) {
        return;
      }
    } catch {
      // Previous content is not comparable; fall through and emit.
    }
  }
  const serialized = JSON.stringify(state, null, 2);
  if (serialized === lastContent) return;
  lastContent = serialized;
  emit('update:currentContent', serialized);
}

function scheduleUpdate(): void {
  if (suppressAutosave) return;
  window.clearTimeout(updateTimer);
  updateTimer = window.setTimeout(commitWorkspaceToOpenCloud, 90);
}

function fitWorkspace(): void {
  if (!workspace.value) return;
  Blockly.svgResize(workspace.value);
  workspace.value.zoomToFit();
}

function withSuppressedAutosave(action: () => void): void {
  suppressAutosave = true;
  window.clearTimeout(updateTimer);
  try {
    action();
  } finally {
    // Blockly may emit change events asynchronously while loading.
    window.setTimeout(() => {
      suppressAutosave = false;
    }, 0);
  }
}

function loadStarter(options: {persist?: boolean} = {}): void {
  if (!workspace.value) return;
  withSuppressedAutosave(() => {
    workspace.value!.clear();
    Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(starterXml), workspace.value!);
    refreshPreview();
    window.setTimeout(fitWorkspace, 30);
  });
  hasAppliedContent = true;
  contentLoadFailed = false;
  if (options.persist !== false && !props.isReadOnly) {
    commitWorkspaceToOpenCloud();
  }
}

function loadProject(content: string): void {
  if (!workspace.value) return;

  withSuppressedAutosave(() => {
    const project = parseProject(content);
    workspace.value!.clear();
    Blockly.serialization.workspaces.load(project.workspace, workspace.value!);
    projectName.value = project.name || 'Unbenanntes Projekt';
    applyDeviceProfile(project.deviceProfile ?? '');
    lastContent = content;
    refreshPreview();
    window.setTimeout(fitWorkspace, 30);
  });
  hasAppliedContent = true;
  contentLoadFailed = false;
}

function loadContent(content: string): void {
  if (!workspace.value) return;

  if (!content.trim()) {
    if (!hasAppliedContent && resourceExpectsFileContent(props.resource)) {
      // AppWrapper still loads the file; keep the canvas empty until content arrives.
      generatedCode.value = '# Datei wird geladen …';
      return;
    }

    projectName.value =
      props.resource?.name?.replace(/\.blockberry\.json$|\.json$/i, '') || 'Neue Steuerung';
    loadStarter({persist: true});
    return;
  }

  loadProject(content);
}

function resetProject(): void {
  if (props.isReadOnly || !window.confirm('Aktuelles Projekt zurücksetzen?')) return;
  projectName.value = 'Neue Steuerung';
  loadStarter({persist: true});
}

function centerWorkspace(): void {
  fitWorkspace();
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
  refreshPreview();
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
  showToast('Berry-Code kopiert');
}

watch(
  () => props.currentContent,
  (content) => {
    if (!workspace.value || content === lastContent) return;
    try {
      loadContent(content);
    } catch (error) {
      contentLoadFailed = true;
      generatedCode.value = `# Projekt konnte nicht geladen werden\n# ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  },
);

onMounted(async () => {
  Blockly.setLocale(De as unknown as Record<string, string>);
  registerBlockBerryBlocks();
  await nextTick();

  const blockBerryTheme = Blockly.Theme.defineTheme('blockberry', {
    name: 'blockberry',
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#f7f8f6',
      toolboxBackgroundColour: '#eef1ef',
      flyoutBackgroundColour: '#fafbfa',
      flyoutForegroundColour: '#45544d',
      flyoutOpacity: 1,
      scrollbarColour: '#aebbb5',
      scrollbarOpacity: 0.55,
      insertionMarkerColour: '#d63b65',
      insertionMarkerOpacity: 0.4,
      cursorColour: '#d63b65',
    },
    fontStyle: {
      family: 'Manrope, sans-serif',
      weight: '600',
      size: 10,
    },
  });

  workspace.value = Blockly.inject(editorElement.value!, {
    toolbox: props.isReadOnly
      ? undefined
      : toolboxForProfile(selectedProfileId.value || null),
    theme: blockBerryTheme,
    readOnly: props.isReadOnly,
    renderer: 'zelos',
    trashcan: !props.isReadOnly,
    sounds: false,
    move: {
      scrollbars: {horizontal: true, vertical: true},
      drag: true,
      wheel: true,
    },
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
  resizeObserver = new ResizeObserver(() => {
    if (!workspace.value) return;
    Blockly.svgResize(workspace.value);
  });
  resizeObserver.observe(editorElement.value!);

  await loadDeviceProfilesFromCouch();

  try {
    loadContent(props.currentContent || '');
  } catch (error) {
    contentLoadFailed = true;
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
