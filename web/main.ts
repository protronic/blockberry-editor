import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as De from 'blockly/msg/de';
import {
  berryGenerator,
  blockBerryToolbox,
  deviceProfiles,
  refreshSpsChannelFields,
  registerBlockBerryBlocks,
  setActiveDeviceProfile,
  setDeviceProfiles,
  toolboxForProfile,
} from '../src/library.ts';
import {
  currentUsername,
  getAccessToken,
  initAuth,
  isAuthenticated,
  login,
  logout,
} from './auth.ts';
import {
  configureCouchAuth,
  listCloudProfiles,
  listCloudProjects,
  loadCloudProject,
  saveCloudProject,
  type ProjectFile,
} from './couch.ts';
import './styles.css';

configureCouchAuth(getAccessToken);

const STORAGE_KEY = 'blockberry.project.v1';
const ENDPOINT_KEY = 'blockberry.deviceEndpoint';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Element #${id} fehlt`);
  return found as T;
}

Blockly.setLocale(De);
registerBlockBerryBlocks();

const blockBerryTheme = Blockly.Theme.defineTheme('blockberry', {
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

const workspace = Blockly.inject('blockly-editor', {
  toolbox: blockBerryToolbox,
  theme: blockBerryTheme,
  renderer: 'zelos',
  trashcan: true,
  sounds: false,
  move: {
    scrollbars: {
      horizontal: true,
      vertical: true,
    },
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
  grid: {
    spacing: 24,
    length: 2,
    colour: '#d9dfdc',
    snap: true,
  },
});

const projectName = element<HTMLInputElement>('project-name');
const deviceProfileSelect = element<HTMLSelectElement>('device-profile');
const codeElement = element<HTMLElement>('berry-code');
const lineCount = element<HTMLElement>('line-count');
const byteCount = element<HTMLElement>('byte-count');
const blockCount = element<HTMLElement>('block-count');
const fileInput = element<HTMLInputElement>('project-file');
const deployDialog = element<HTMLDialogElement>('deploy-dialog');
const deployForm = element<HTMLFormElement>('deploy-form');
const endpointInput = element<HTMLInputElement>('device-endpoint');
const deployResult = element<HTMLElement>('deploy-result');
const cloudDialog = element<HTMLDialogElement>('cloud-dialog');
const cloudResult = element<HTMLElement>('cloud-result');
const cloudList = element<HTMLElement>('cloud-project-list');
const authStatus = element<HTMLElement>('auth-status');
const authButton = element<HTMLButtonElement>('auth-button');
const toast = element<HTMLElement>('toast');

let generatedCode = '';
let updateTimer = 0;
let toastTimer = 0;
let cloudDocId: string | undefined;
let cloudDocRev: string | undefined;

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

function showToast(message: string): void {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2200);
}

function selectedProfileId(): string {
  return deviceProfileSelect.value.trim();
}

function applyDeviceProfile(profileId: string, announce = false): void {
  deviceProfileSelect.value = profileId;
  setActiveDeviceProfile(profileId || null);
  workspace.updateToolbox(toolboxForProfile(profileId || null));
  refreshSpsChannelFields(workspace);
  if (announce) {
    const profile = deviceProfiles.find((entry) => entry.id === profileId);
    showToast(profile ? `Profil: ${profile.name}` : 'Alle Blöcke');
  }
  persistLocally();
}

function populateDeviceProfiles(): void {
  const selected = selectedProfileId();
  deviceProfileSelect.replaceChildren();

  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'Alle Blöcke';
  deviceProfileSelect.append(allOption);

  for (const profile of deviceProfiles) {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = profile.name;
    deviceProfileSelect.append(option);
  }

  if (selected && deviceProfiles.some((profile) => profile.id === selected)) {
    deviceProfileSelect.value = selected;
  } else if (selected) {
    applyDeviceProfile('');
  }
}

async function loadDeviceProfilesFromCloud(): Promise<void> {
  setDeviceProfiles([]);
  populateDeviceProfiles();
  if (!isAuthenticated()) {
    applyDeviceProfile('');
    return;
  }
  try {
    const profiles = await listCloudProfiles();
    setDeviceProfiles(profiles);
    populateDeviceProfiles();
    applyDeviceProfile(selectedProfileId());
  } catch (error) {
    console.warn('Cloud device profiles unavailable', error);
    setDeviceProfiles([]);
    populateDeviceProfiles();
    applyDeviceProfile('');
  }
}

function projectState(): ProjectFile {
  const profileId = selectedProfileId();
  return {
    format: 'blockberry',
    version: 1,
    name: projectName.value.trim() || 'Unbenanntes Projekt',
    savedAt: new Date().toISOString(),
    workspace: Blockly.serialization.workspaces.save(workspace),
    ...(profileId ? {deviceProfile: profileId} : {}),
  };
}

function persistLocally(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projectState()));
}

function updateAuthUi(): void {
  const loggedIn = isAuthenticated();
  authStatus.textContent = loggedIn ? currentUsername() : 'Gast';
  authButton.textContent = loggedIn ? 'Abmelden' : 'Anmelden';
}

async function ensureLoggedIn(): Promise<boolean> {
  if (isAuthenticated()) return true;
  showToast('Anmeldung erforderlich');
  await login();
  return false;
}

function updateOutput(): void {
  try {
    generatedCode = berryGenerator.workspaceToCode(workspace);
    codeElement.textContent = generatedCode;
    const lines = generatedCode.trimEnd() ? generatedCode.trimEnd().split('\n').length : 0;
    lineCount.textContent = String(lines);
    byteCount.textContent = String(new TextEncoder().encode(generatedCode).length);
    const count = workspace.getAllBlocks(false).length;
    blockCount.textContent = `${count} ${count === 1 ? 'Block' : 'Blöcke'}`;
    persistLocally();
  } catch (error) {
    codeElement.textContent = `# Generatorfehler\n# ${error instanceof Error ? error.message : String(error)}`;
  }
}

function scheduleUpdate(): void {
  window.clearTimeout(updateTimer);
  updateTimer = window.setTimeout(updateOutput, 90);
}

function loadProject(project: Partial<ProjectFile>): void {
  if (project.format !== 'blockberry' || project.version !== 1 || !project.workspace) {
    throw new Error('Keine gültige BlockBerry-Projektdatei');
  }
  workspace.clear();
  Blockly.serialization.workspaces.load(project.workspace, workspace);
  projectName.value = project.name || 'Unbenanntes Projekt';
  applyDeviceProfile(project.deviceProfile ?? '');
  scheduleUpdate();
  window.setTimeout(() => workspace.zoomToFit(), 30);
}

function loadStarter(): void {
  cloudDocId = undefined;
  cloudDocRev = undefined;
  workspace.clear();
  const xml = Blockly.utils.xml.textToDom(starterXml);
  Blockly.Xml.domToWorkspace(xml, workspace);
  window.setTimeout(() => workspace.zoomToFit(), 30);
  updateOutput();
}

function download(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFilename(extension: string): string {
  const base = (projectName.value || 'blockberry')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß_-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'blockberry'}${extension}`;
}

function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso || '—';
  return date.toLocaleString('de-DE');
}

async function refreshCloudList(): Promise<void> {
  cloudResult.classList.remove('error');
  cloudResult.textContent = 'Lade Projekte …';
  cloudList.replaceChildren();
  try {
    const projects = await listCloudProjects();
    if (!projects.length) {
      cloudResult.textContent = 'Noch keine Projekte in der Cloud.';
      return;
    }
    cloudResult.textContent = `${projects.length} Projekt${projects.length === 1 ? '' : 'e'}`;
    for (const project of projects) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = `<strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project._id)} · ${escapeHtml(formatSavedAt(project.savedAt))}</small>`;
      button.addEventListener('click', async () => {
        try {
          const doc = await loadCloudProject(project._id);
          loadProject(doc);
          cloudDocId = doc._id;
          cloudDocRev = doc._rev;
          cloudDialog.close();
          showToast('Cloud-Projekt geladen');
        } catch (error) {
          cloudResult.classList.add('error');
          cloudResult.textContent =
            error instanceof Error ? error.message : 'Laden fehlgeschlagen';
        }
      });
      item.append(button);
      cloudList.append(item);
    }
  } catch (error) {
    cloudResult.classList.add('error');
    cloudResult.textContent =
      error instanceof Error ? error.message : 'Cloud-Liste fehlgeschlagen';
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

workspace.addChangeListener((event) => {
  if (!event.isUiEvent) scheduleUpdate();
});

projectName.addEventListener('input', scheduleUpdate);

deviceProfileSelect.addEventListener('change', () => {
  applyDeviceProfile(selectedProfileId(), true);
});

element('new-project').addEventListener('click', () => {
  if (workspace.getAllBlocks(false).length && !window.confirm('Aktuelles Projekt verwerfen?')) return;
  projectName.value = 'Neue Steuerung';
  loadStarter();
  showToast('Neues Projekt angelegt');
});

element('save-project').addEventListener('click', () => {
  const serialized = JSON.stringify(projectState(), null, 2);
  download(serialized, safeFilename('.blockberry.json'), 'application/json');
  showToast('Projektdatei gespeichert');
});

element('load-project').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    loadProject(JSON.parse(await file.text()) as ProjectFile);
    cloudDocId = undefined;
    cloudDocRev = undefined;
    showToast('Projekt geladen');
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Projekt konnte nicht geladen werden');
  } finally {
    fileInput.value = '';
  }
});

element('export-script').addEventListener('click', () => {
  updateOutput();
  download(generatedCode, safeFilename('.be'), 'text/plain;charset=utf-8');
  showToast('Berry-Skript exportiert');
});

element('copy-code').addEventListener('click', async () => {
  await navigator.clipboard.writeText(generatedCode);
  showToast('Berry-Code kopiert');
});

element('center-workspace').addEventListener('click', () => workspace.zoomToFit());

authButton.addEventListener('click', async () => {
  if (isAuthenticated()) {
    await logout();
    return;
  }
  await login();
});

element('save-cloud').addEventListener('click', async () => {
  if (!(await ensureLoggedIn())) return;
  try {
    const saved = await saveCloudProject(projectState(), {
      id: cloudDocId,
      rev: cloudDocRev,
      owner: currentUsername(),
    });
    cloudDocId = saved._id;
    cloudDocRev = saved._rev;
    showToast('In Cloud gespeichert');
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Cloud-Speichern fehlgeschlagen');
  }
});

element('open-cloud').addEventListener('click', async () => {
  if (!(await ensureLoggedIn())) return;
  cloudDialog.showModal();
  await refreshCloudList();
});

element('close-cloud').addEventListener('click', () => cloudDialog.close());
element('cancel-cloud').addEventListener('click', () => cloudDialog.close());
element('refresh-cloud').addEventListener('click', () => {
  void refreshCloudList();
});

function closeDeployDialog(): void {
  deployDialog.close();
  deployResult.textContent = '';
  deployResult.classList.remove('error');
}

element('open-deploy').addEventListener('click', () => {
  endpointInput.value = localStorage.getItem(ENDPOINT_KEY) ?? '';
  deployDialog.showModal();
  window.setTimeout(() => endpointInput.focus(), 0);
});
element('close-deploy').addEventListener('click', closeDeployDialog);
element('cancel-deploy').addEventListener('click', closeDeployDialog);

deployForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const endpoint = endpointInput.value.trim();
  localStorage.setItem(ENDPOINT_KEY, endpoint);
  deployResult.classList.remove('error');
  deployResult.textContent = 'Übertragung läuft …';

  try {
    updateOutput();
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {'Content-Type': 'text/plain; charset=utf-8'},
      body: generatedCode,
    });
    if (!response.ok) throw new Error(`Gerät antwortet mit HTTP ${response.status}`);
    deployResult.textContent = 'Skript erfolgreich übertragen.';
    window.setTimeout(closeDeployDialog, 900);
  } catch (error) {
    deployResult.classList.add('error');
    deployResult.textContent =
      error instanceof Error ? error.message : 'Übertragung fehlgeschlagen';
  }
});

window.addEventListener('resize', () => Blockly.svgResize(workspace));

populateDeviceProfiles();

const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
  try {
    loadProject(JSON.parse(saved) as ProjectFile);
  } catch {
    loadStarter();
  }
} else {
  loadStarter();
}

void initAuth().then(async () => {
  updateAuthUi();
  await loadDeviceProfilesFromCloud();
});
