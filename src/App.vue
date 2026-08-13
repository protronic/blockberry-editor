<template>
  <div class="app-shell blockberry-app">
    <header class="topbar">
      <div class="brand" aria-label="BlockBerry Editor">
        <span class="brand-mark" aria-hidden="true"><span /><span /><span /></span>
        <span class="brand-name">Block<span>Berry</span></span>
        <span class="brand-tag">OpenCloud</span>
      </div>

      <ViewSwitch :current="appView" @change="setAppView" />

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
        <template v-if="appView === 'editor'">
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
        </template>
        <ReplMenu v-else />
        <button
          class="about-btn"
          type="button"
          title="Über BlockBerry"
          aria-label="Über BlockBerry"
          @click="openAbout"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 3.9a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2zM7.1 7h1.8v5.2H7.1z"
            />
          </svg>
        </button>
      </nav>
    </header>

    <div class="view-body">
    <main v-show="appView === 'editor'" class="workspace-layout">
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
          <div class="code-heading-actions">
            <img
              v-if="livePreviewImage"
              class="live-preview-thumb"
              :src="livePreviewImage"
              alt=""
              title="Eingebettete Dateivorschau"
            />
            <button class="icon-button dark" type="button" @click="copyCode">Kopieren</button>
          </div>
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

    <BleRepl
      v-if="replOpened"
      v-show="appView === 'repl'"
      embedded
      :script="generatedCode"
      :script-name="safeScriptName()"
    />
    </div>

    <footer class="statusbar">
      <span><i class="status-ready" /> BlockBerry bereit</span>
      <span>.bbprj → Blockly → Berry</span>
      <button class="git-ref" type="button" :title="aboutInfo.commit" @click="openAbout">
        {{ aboutInfo.commit }}
      </button>
      <span>{{ blockCount }} Blöcke</span>
    </footer>

    <dialog
      ref="aboutDialog"
      class="about-dialog"
      aria-labelledby="about-title"
      @click="onAboutBackdrop"
      @cancel="closeAbout"
    >
      <div class="dialog-body">
        <div class="dialog-heading">
          <div>
            <span class="eyebrow">OpenCloud</span>
            <h2 id="about-title">BlockBerry Editor</h2>
          </div>
          <button class="dialog-close" type="button" aria-label="Schließen" @click="closeAbout">
            ×
          </button>
        </div>
        <dl class="about-rows">
          <dt>Version</dt>
          <dd>{{ aboutInfo.version }}</dd>
          <dt>Git-Commit</dt>
          <dd class="about-mono">{{ aboutInfo.commit }}</dd>
          <dt>Build</dt>
          <dd>{{ aboutInfo.buildTime }}</dd>
          <dt>Blockly</dt>
          <dd>{{ aboutInfo.blocklyVersion }}</dd>
        </dl>
        <div class="dialog-actions">
          <button class="button ghost dark-text" type="button" @click="closeAbout">
            Schließen
          </button>
        </div>
      </div>
    </dialog>

    <div ref="toastElement" class="toast" role="status" aria-live="polite" />
  </div>
</template>

<script setup lang="ts">
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as De from 'blockly/msg/de';
import type {Resource} from '@opencloud-eu/web-client';
import {useAuthStore, useRouter} from '@opencloud-eu/web-pkg';
import {computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch} from 'vue';
import {
  configureCouchAuth,
  listCloudProfiles,
} from '../web/couch';
import {
  publishScript,
  rememberEditor,
  type AppView,
} from './ble/session';
import {blocklyMediaUrl} from './blocklyMedia';
import {
  berryGenerator,
  deviceProfiles,
  refreshSpsChannelFields,
  registerBlockBerryBlocks,
  setActiveDeviceProfile,
  setDeviceProfiles,
  toolboxForProfile,
  type DeviceProfile,
} from './library';
import {captureWorkspacePreview} from './preview';
import {
  type ProjectFile,
  parseProject,
  projectSignature,
  stripKnownProjectExtension,
} from './project';
import ReplMenu from './components/ReplMenu.vue';
import ViewSwitch from './components/ViewSwitch.vue';
import BleRepl from './views/BleRepl.vue';

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
const router = useRouter();
configureCouchAuth(async () => {
  const token = authStore.accessToken;
  if (!token) {
    throw new Error('Kein OpenCloud Access Token — bitte in OpenCloud anmelden');
  }
  return token;
});

const editorElement = ref<HTMLElement>();
const toastElement = ref<HTMLElement>();
const aboutDialog = ref<HTMLDialogElement>();

const aboutInfo = {
  version: __BB_VERSION__,
  commit: __BB_COMMIT__,
  buildTime: new Date(__BB_BUILD_TIME__).toLocaleString('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }),
  blocklyVersion: Blockly.VERSION,
};
const projectName = ref('Neue Steuerung');
const selectedProfileId = ref('');
const profileOptions = ref<DeviceProfile[]>([]);
const generatedCode = ref('# Generator wird initialisiert …');
const blockCount = ref(0);
const livePreviewImage = ref('');
const appView = ref<AppView>('editor');
const replOpened = ref(false);
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
  const name = projectName.value.trim() || 'Unbenanntes Projekt';
  const state: ProjectFile = {
    format: 'blockberry',
    version: 1,
    name,
    savedAt: new Date().toISOString(),
    workspace: Blockly.serialization.workspaces.save(workspace.value!),
    ...(profileId ? {deviceProfile: profileId} : {}),
  };

  try {
    state.preview = captureWorkspacePreview(workspace.value!, name);
  } catch {
    // Preview is best-effort; never block saving the project itself.
  }

  return state;
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
  setDeviceProfiles([]);
  syncProfileOptions();

  if (!authStore.accessToken) {
    console.warn('OpenCloud Access Token fehlt — keine Geräteprofile');
    applyDeviceProfile('');
    return;
  }

  try {
    const profiles = await listCloudProfiles();
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
    console.warn('Cloud device profiles unavailable', error);
    setDeviceProfiles([]);
    syncProfileOptions();
    applyDeviceProfile('');
  }
}

function refreshPreview(): void {
  if (!workspace.value) return;
  try {
    generatedCode.value = berryGenerator.workspaceToCode(workspace.value);
    blockCount.value = workspace.value.getAllBlocks(false).length;
    livePreviewImage.value = captureWorkspacePreview(
      workspace.value,
      projectName.value.trim() || 'Unbenanntes Projekt',
    ).image;
  } catch (error) {
    generatedCode.value = `# Generatorfehler\n# ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

function commitWorkspaceToOpenCloud(): void {
  // contentLoadFailed guards against overwriting the stored file with a
  // partially applied workspace after a failed load.
  if (!workspace.value || props.isReadOnly || suppressAutosave || contentLoadFailed) return;
  refreshPreview();
  const state = projectState();
  if (lastContent) {
    try {
      const previous = JSON.parse(lastContent) as ProjectFile;
      if (previous.workspace && projectSignature(previous) === projectSignature(state)) {
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
    if (project.preview?.image) {
      livePreviewImage.value = project.preview.image;
    }
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

    projectName.value = stripKnownProjectExtension(props.resource?.name);
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

function setAppView(view: AppView): void {
  if (view === 'repl') {
    publishScript(generatedCode.value, safeScriptName());
    rememberEditor(router.currentRoute.value);
    replOpened.value = true;
  }
  appView.value = view;
  if (view === 'editor') {
    void nextTick(() => {
      if (!workspace.value) return;
      Blockly.svgResize(workspace.value);
      fitWorkspace();
    });
  }
}

function openAbout(): void {
  aboutDialog.value?.showModal();
}

function closeAbout(): void {
  aboutDialog.value?.close();
}

function onAboutBackdrop(event: MouseEvent): void {
  if (event.target === aboutDialog.value) closeAbout();
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

watch([generatedCode, projectName], () => {
  publishScript(generatedCode.value, safeScriptName());
});

onMounted(async () => {
  rememberEditor(router.currentRoute.value);
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
    // Local media (dist/web/media) — CDN is blocked by OpenCloud CSP img-src.
    media: blocklyMediaUrl(),
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
<!--
  Unscoped: Blockly SVGs and OpenCloud Tailwind live outside this component's
  data-v scope. Tailwind preflight sets `svg { display: block }`, which overrides
  Blockly's display="none" attribute on hidden flyout scrollbars.
-->
<style>
.blocklyFlyoutScrollbar[display='none'],
.blocklyMainWorkspaceScrollbar[display='none'],
.blockberry-app svg.blocklyScrollbarVertical[display='none'],
.blockberry-app svg.blocklyScrollbarHorizontal[display='none'] {
  display: none !important;
}
</style>
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

.code-heading-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.live-preview-thumb {
  width: 54px;
  height: 30px;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 7px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

button:disabled,
input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
