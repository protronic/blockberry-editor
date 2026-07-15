import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as De from 'blockly/msg/de';
import {
  berryGenerator,
  blockBerryToolbox,
  registerBlockBerryBlocks,
} from '../src/index.ts';
import {mountSimulator} from './simulator/panel.ts';
import './styles.css';

const STORAGE_KEY = 'blockberry.project.v1';
const ENDPOINT_KEY = 'blockberry.deviceEndpoint';

type ProjectFile = {
  format: 'blockberry';
  version: 1;
  name: string;
  savedAt: string;
  workspace: object;
};

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
const codeElement = element<HTMLElement>('berry-code');
const lineCount = element<HTMLElement>('line-count');
const byteCount = element<HTMLElement>('byte-count');
const blockCount = element<HTMLElement>('block-count');
const fileInput = element<HTMLInputElement>('project-file');
const deployDialog = element<HTMLDialogElement>('deploy-dialog');
const deployForm = element<HTMLFormElement>('deploy-form');
const endpointInput = element<HTMLInputElement>('device-endpoint');
const deployResult = element<HTMLElement>('deploy-result');
const toast = element<HTMLElement>('toast');
const simulator = mountSimulator(workspace);

let generatedCode = '';
let updateTimer = 0;
let toastTimer = 0;

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
      <block type="sps_digital_output">
        <field name="CHANNEL">LED_STATUS</field>
        <value name="VALUE">
          <block type="sps_digital_input">
            <field name="CHANNEL">DI_ALARM</field>
          </block>
        </value>
        <next>
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

function projectState(): ProjectFile {
  return {
    format: 'blockberry',
    version: 1,
    name: projectName.value.trim() || 'Unbenanntes Projekt',
    savedAt: new Date().toISOString(),
    workspace: Blockly.serialization.workspaces.save(workspace),
  };
}

function persistLocally(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projectState()));
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
    simulator.sync();
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
  scheduleUpdate();
  window.setTimeout(() => workspace.zoomToFit(), 30);
}

function loadStarter(): void {
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

workspace.addChangeListener((event) => {
  if (!event.isUiEvent) {
    if (simulator.engine.snapshot().running) simulator.engine.stop();
    scheduleUpdate();
  }
});

projectName.addEventListener('input', scheduleUpdate);

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
