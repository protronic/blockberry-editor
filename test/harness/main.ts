import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as De from 'blockly/msg/de';
import {createPinia} from 'pinia';
import {createApp, defineComponent, h, ref, shallowRef} from 'vue';
import type {Resource} from '@opencloud-eu/web-client';
import {blockBerryToolbox, registerBlockBerryBlocks} from '../../src/library';
import App from '../../src/App.vue';

function probeTheme(): Blockly.Theme {
  return Blockly.Theme.defineTheme(`blockberry-probe-${Math.random().toString(36).slice(2)}`, {
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
}

type HarnessState = {
  scenario: string;
  projectJson: string;
  emitted: string[];
  errors: string[];
};

declare global {
  interface Window {
    __harness: HarnessState;
  }
}

const params = new URLSearchParams(window.location.search);
const scenario = params.get('scenario') ?? 'existing';

window.addEventListener('error', (event) => {
  window.__harness?.errors.push(String(event.error ?? event.message));
});
window.addEventListener('unhandledrejection', (event) => {
  window.__harness?.errors.push(String(event.reason));
});

registerBlockBerryBlocks();

const projectXml = `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="mini_sps_task" x="24" y="24">
    <field name="NAME">pumpensteuerung</field>
    <field name="INTERVAL">250</field>
    <statement name="LOOP">
      <block type="monitor_value">
        <field name="METRIC">druck</field>
        <field name="UNIT">bar</field>
        <value name="VALUE">
          <block type="od_read">
            <field name="INDEX">0x2100</field>
            <field name="SUBINDEX">1</field>
          </block>
        </value>
      </block>
    </statement>
  </block>
  <block type="mini_sps_task" x="24" y="320">
    <field name="NAME">lueftersteuerung</field>
    <field name="INTERVAL">1000</field>
    <statement name="LOOP">
      <block type="signal_set">
        <field name="SIGNAL">luefter</field>
        <field name="STATE">normal</field>
      </block>
    </statement>
  </block>
</xml>`;

const headless = new Blockly.Workspace();
Blockly.Xml.domToWorkspace(Blockly.utils.xml.textToDom(projectXml), headless);
const expectedBlockCount = headless.getAllBlocks(false).length;
const projectJson = JSON.stringify(
  {
    format: 'blockberry',
    version: 1,
    name: 'Pumpenhaus',
    savedAt: '2026-08-01T09:00:00.000Z',
    workspace: Blockly.serialization.workspaces.save(headless),
  },
  null,
  2,
);
headless.dispose();

window.__harness = {
  scenario,
  projectJson,
  emitted: [],
  errors: [],
};
document.title = `harness:${scenario} expecting ${expectedBlockCount} blocks`;

if (scenario === 'probe') {
  Blockly.setLocale(De as unknown as Record<string, string>);
  const parsed = JSON.parse(projectJson) as {workspace: object};
  const appZoom = {
    controls: true,
    wheel: true,
    startScale: 0.86,
    maxScale: 1.5,
    minScale: 0.4,
    scaleSpeed: 1.1,
  };
  const appGrid = {spacing: 24, length: 2, colour: '#d9dfdc', snap: true};
  const appMove = {scrollbars: {horizontal: true, vertical: true}, drag: true, wheel: true};
  const variants: Array<[string, Blockly.BlocklyOptions]> = [
    ['plain-zelos', {renderer: 'zelos'}],
    ['zoom', {renderer: 'zelos', zoom: appZoom}],
    ['grid', {renderer: 'zelos', grid: appGrid}],
    ['move', {renderer: 'zelos', move: appMove}],
    ['trashcan', {renderer: 'zelos', trashcan: true}],
    ['zoom+grid+move', {renderer: 'zelos', zoom: appZoom, grid: appGrid, move: appMove}],
    [
      'app-config',
      {
        renderer: 'zelos',
        trashcan: true,
        sounds: false,
        move: appMove,
        zoom: appZoom,
        grid: appGrid,
      },
    ],
    ['theme', {renderer: 'zelos', theme: probeTheme()}],
    ['toolbox', {renderer: 'zelos', toolbox: blockBerryToolbox}],
    ['theme+toolbox', {renderer: 'zelos', theme: probeTheme(), toolbox: blockBerryToolbox}],
    [
      'app-full',
      {
        renderer: 'zelos',
        theme: probeTheme(),
        toolbox: blockBerryToolbox,
        trashcan: true,
        sounds: false,
        move: appMove,
        zoom: appZoom,
        grid: appGrid,
      },
    ],
    ['zero-size', {renderer: 'zelos'}],
    ['hidden', {renderer: 'zelos'}],
    ['vue-deep-ref', {renderer: 'zelos'}],
    ['vue-shallow-ref', {renderer: 'zelos'}],
  ];
  for (const [label, options] of variants) {
    const probeDiv = document.createElement('div');
    probeDiv.style.width = label === 'zero-size' ? '0px' : '800px';
    probeDiv.style.height = label === 'zero-size' ? '0px' : '600px';
    if (label === 'hidden') probeDiv.style.display = 'none';
    document.body.appendChild(probeDiv);
    let probeWs: Blockly.WorkspaceSvg | undefined;
    try {
      if (label === 'vue-deep-ref') {
        const wsRef = ref<Blockly.WorkspaceSvg>();
        wsRef.value = Blockly.inject(probeDiv, options);
        probeWs = wsRef.value;
      } else if (label === 'vue-shallow-ref') {
        const wsRef = shallowRef<Blockly.WorkspaceSvg>();
        wsRef.value = Blockly.inject(probeDiv, options);
        probeWs = wsRef.value;
      } else {
        probeWs = Blockly.inject(probeDiv, options);
      }
      probeWs.clear();
      Blockly.serialization.workspaces.load(parsed.workspace, probeWs);
      window.__harness.errors.push(
        `probe[${label}] ok: ${probeWs.getAllBlocks(false).length}/${expectedBlockCount} blocks`,
      );
    } catch (error) {
      window.__harness.errors.push(
        `probe[${label}] FAILED with ${probeWs?.getAllBlocks(false).length ?? 'n/a'}/${expectedBlockCount} blocks: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      probeWs?.dispose();
      probeDiv.remove();
    }
  }
}

const origLoad = Blockly.serialization.workspaces.load.bind(Blockly.serialization.workspaces);
(Blockly.serialization.workspaces as {load: typeof origLoad}).load = (state, ws, options) => {
  const t = Math.round(performance.now());
  try {
    const result = origLoad(state, ws, options);
    window.__harness.errors.push(
      `[${t}ms] ws.load ok -> ${ws.getAllBlocks(false).length} blocks`,
    );
    return result;
  } catch (error) {
    window.__harness.errors.push(
      `[${t}ms] ws.load threw at ${ws.getAllBlocks(false).length} blocks: ${
        error instanceof Error ? `${error.name}: ${error.message}\n${error.stack}` : String(error)
      }`,
    );
    throw error;
  }
};

const origClear = Blockly.Workspace.prototype.clear;
Blockly.Workspace.prototype.clear = function (this: Blockly.Workspace) {
  window.__harness.errors.push(`[${Math.round(performance.now())}ms] ws.clear`);
  return origClear.call(this);
};

function makeResource(size: number): Resource {
  return {
    id: 'res-1',
    name: 'pumpenhaus.blockberry.json',
    path: '/pumpenhaus.blockberry.json',
    size,
    extension: 'json',
    mimeType: 'application/json',
  } as unknown as Resource;
}

// Mimics @opencloud-eu/web-pkg AppWrapper: the wrapped component is only
// rendered after the file content request finished; content updates flow
// back in via update:currentContent and are reflected into the prop.
const Host = defineComponent({
  setup() {
    const currentContent = ref('');
    const mountChild = ref(false);
    const resource = ref<Resource>(makeResource(projectJson.length));

    if (scenario === 'existing') {
      currentContent.value = projectJson;
      mountChild.value = true;
    } else if (scenario === 'empty') {
      resource.value = makeResource(0);
      mountChild.value = true;
    } else if (scenario === 'late') {
      mountChild.value = true;
      window.setTimeout(() => {
        currentContent.value = projectJson;
      }, 400);
    }

    return () =>
      mountChild.value
        ? h(App, {
            currentContent: currentContent.value,
            isReadOnly: false,
            resource: resource.value,
            'onUpdate:currentContent': (value: string) => {
              window.__harness.errors.push(
                `[${Math.round(performance.now())}ms] emit update:currentContent (${value.length} chars, name=${
                  (JSON.parse(value) as {name?: string}).name
                })`,
              );
              window.__harness.emitted.push(value);
              currentContent.value = value;
            },
          })
        : h('div', 'wrapper loading');
  },
});

// The OpenCloud host installs Pinia app-wide; App.vue's useAuthStore relies on it.
createApp(Host).use(createPinia()).mount('#host');
