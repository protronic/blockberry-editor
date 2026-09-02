/**
 * Framework-agnostic embedding API for the BlockBerry editor.
 *
 * Hosts the Blockly workspace with the BlockBerry blocks, toolbox, device
 * profiles and Berry generator in any plain DOM container, so the same
 * editor core can run inside OpenCloud (Vue), the standalone web app and
 * host applications built with other frameworks (e.g. Angular).
 *
 * The host application owns persistence: it receives the serialized
 * `.bbprj` project via `onChange` and passes stored content back in via
 * `options.content` or `loadContent()`.
 */
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import * as MsgDe from 'blockly/msg/de';
import * as MsgEn from 'blockly/msg/en';
import {registerBlockBerryBlocks} from './blocks.js';
import {berryGenerator} from './berry_generator.js';
import {toolboxForProfile} from './toolbox.js';
import {deviceProfiles, setDeviceProfiles, type DeviceProfile} from './device_profiles.js';
import {refreshSpsChannelFields, setActiveDeviceProfile} from './active_profile.js';
import {captureWorkspacePreview} from './preview.js';
import {parseProject, serializeProject, type ProjectFile} from './project.js';

export type BlockBerryEditorState = {
  /** Serialized `.bbprj` project file content. */
  content: string;
  /** Generated Berry source. */
  code: string;
  blockCount: number;
  projectName: string;
  deviceProfile: string;
};

export type BlockBerryEditorOptions = {
  /** Element the Blockly workspace is injected into. Must have a size. */
  container: HTMLElement;
  /** Initial `.bbprj` content; empty or omitted starts a blank project. */
  content?: string;
  projectName?: string;
  readOnly?: boolean;
  locale?: 'de' | 'en';
  /**
   * URL of the Blockly media directory (sprites, cursors). Host apps should
   * serve `node_modules/blockly/media` themselves (e.g. as static assets)
   * and pass its URL; otherwise Blockly falls back to its CDN default.
   */
  mediaUrl?: string;
  /** Device profile id to activate initially. */
  deviceProfile?: string | null;
  /** Replaces the available device profiles (e.g. loaded from a backend). */
  profiles?: DeviceProfile[];
  /** Fired debounced after every model change with the current state. */
  onChange?: (state: BlockBerryEditorState) => void;
};

export type BlockBerryEditorHandle = {
  readonly workspace: Blockly.WorkspaceSvg;
  /** Loads `.bbprj` content, replacing the current project. */
  loadContent(content: string): void;
  /** Current state (also delivered via onChange). */
  getState(): BlockBerryEditorState;
  setProjectName(name: string): void;
  /** Activates a device profile ('' or null shows all blocks). */
  setDeviceProfile(id: string | null): void;
  listDeviceProfiles(): DeviceProfile[];
  /** Call when the container was resized (or use your own ResizeObserver). */
  resize(): void;
  destroy(): void;
};

let blocksRegistered = false;

function blockBerryTheme(): Blockly.Theme {
  return Blockly.Theme.defineTheme('blockberry', {
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
      family: 'Manrope, system-ui, sans-serif',
      weight: '600',
      size: 10,
    },
  });
}

export function createBlockBerryEditor(
  options: BlockBerryEditorOptions,
): BlockBerryEditorHandle {
  const {container, onChange} = options;
  const readOnly = options.readOnly ?? false;

  Blockly.setLocale(
    (options.locale === 'en' ? MsgEn : MsgDe) as unknown as Record<string, string>,
  );
  if (!blocksRegistered) {
    registerBlockBerryBlocks();
    blocksRegistered = true;
  }
  if (options.profiles) {
    setDeviceProfiles(options.profiles);
  }

  let projectName = options.projectName ?? 'Neue Steuerung';
  let activeProfile = options.deviceProfile ?? '';
  let updateTimer: ReturnType<typeof setTimeout> | undefined;
  let suppressChanges = false;
  let destroyed = false;

  setActiveDeviceProfile(activeProfile || null);

  const workspace = Blockly.inject(container, {
    toolbox: readOnly ? undefined : toolboxForProfile(activeProfile || null),
    theme: blockBerryTheme(),
    readOnly,
    renderer: 'zelos',
    trashcan: !readOnly,
    sounds: false,
    ...(options.mediaUrl ? {media: options.mediaUrl} : {}),
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

  function projectState(): ProjectFile {
    const state: ProjectFile = {
      format: 'blockberry',
      version: 1,
      name: projectName.trim() || 'Unbenanntes Projekt',
      savedAt: new Date().toISOString(),
      workspace: Blockly.serialization.workspaces.save(workspace),
      ...(activeProfile ? {deviceProfile: activeProfile} : {}),
    };
    try {
      state.preview = captureWorkspacePreview(workspace, state.name);
    } catch {
      // Preview is best-effort; never block serialization.
    }
    return state;
  }

  function buildState(): BlockBerryEditorState {
    let code: string;
    try {
      code = berryGenerator.workspaceToCode(workspace);
    } catch (error) {
      code = `# Generatorfehler\n# ${error instanceof Error ? error.message : String(error)}`;
    }
    return {
      content: serializeProject(projectState()),
      code,
      blockCount: workspace.getAllBlocks(false).length,
      projectName,
      deviceProfile: activeProfile,
    };
  }

  function emitChange(): void {
    if (destroyed || suppressChanges) return;
    onChange?.(buildState());
  }

  function scheduleChange(): void {
    if (destroyed || suppressChanges || !onChange) return;
    clearTimeout(updateTimer);
    updateTimer = setTimeout(emitChange, 90);
  }

  function withSuppressedChanges(action: () => void): void {
    suppressChanges = true;
    clearTimeout(updateTimer);
    try {
      action();
    } finally {
      // Blockly may emit change events asynchronously while loading.
      setTimeout(() => {
        suppressChanges = false;
      }, 0);
    }
  }

  function applyDeviceProfile(id: string | null): void {
    activeProfile = id ?? '';
    setActiveDeviceProfile(activeProfile || null);
    if (!readOnly) {
      workspace.updateToolbox(toolboxForProfile(activeProfile || null));
    }
    refreshSpsChannelFields(workspace);
  }

  function loadContent(content: string): void {
    if (!content.trim()) {
      withSuppressedChanges(() => {
        workspace.clear();
      });
      return;
    }
    const project = parseProject(content);
    withSuppressedChanges(() => {
      workspace.clear();
      Blockly.serialization.workspaces.load(project.workspace, workspace);
      projectName = project.name || 'Unbenanntes Projekt';
      applyDeviceProfile(project.deviceProfile ?? '');
      setTimeout(() => {
        if (destroyed) return;
        Blockly.svgResize(workspace);
        workspace.zoomToFit();
      }, 30);
    });
  }

  workspace.addChangeListener((event) => {
    if (!event.isUiEvent) scheduleChange();
  });

  if (options.content) {
    loadContent(options.content);
  }

  return {
    workspace,
    loadContent,
    getState: buildState,
    setProjectName(name: string): void {
      projectName = name;
      scheduleChange();
    },
    setDeviceProfile(id: string | null): void {
      applyDeviceProfile(id);
      scheduleChange();
    },
    listDeviceProfiles(): DeviceProfile[] {
      return [...deviceProfiles];
    },
    resize(): void {
      Blockly.svgResize(workspace);
    },
    destroy(): void {
      destroyed = true;
      clearTimeout(updateTimer);
      workspace.dispose();
    },
  };
}
