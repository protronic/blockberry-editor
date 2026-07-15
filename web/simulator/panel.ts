import type {Workspace} from 'blockly/core';
import {BlockBerrySimulator, type SimulatorSnapshot} from './engine.ts';

function required<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Simulator-Element #${id} fehlt`);
  return value as T;
}

function emptyState(text: string): HTMLElement {
  const empty = document.createElement('div');
  empty.className = 'io-empty';
  empty.textContent = text;
  return empty;
}

function label(name: string, kind: string): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'io-card-label';
  const title = document.createElement('strong');
  title.textContent = name;
  const subtitle = document.createElement('small');
  subtitle.textContent = kind;
  wrapper.append(title, subtitle);
  return wrapper;
}

export function mountSimulator(workspace: Workspace): {
  engine: BlockBerrySimulator;
  sync: () => void;
} {
  const engine = new BlockBerrySimulator(workspace);
  const codeView = document.querySelector<HTMLElement>('.code-wrap');
  const simulatorView = required<HTMLElement>('simulator-panel');
  const codeTab = required<HTMLButtonElement>('show-code');
  const simulatorTab = required<HTMLButtonElement>('show-simulator');
  const title = required<HTMLElement>('preview-title');
  const copyButton = required<HTMLButtonElement>('copy-code');
  const runButton = required<HTMLButtonElement>('sim-run');
  const resetButton = required<HTMLButtonElement>('sim-reset');
  const stateDot = required<HTMLElement>('sim-state-dot');
  const stateLabel = required<HTMLElement>('sim-state');
  const cycleLabel = required<HTMLElement>('sim-cycles');
  const inputGrid = required<HTMLElement>('sim-inputs');
  const outputGrid = required<HTMLElement>('sim-outputs');
  const logView = required<HTMLElement>('sim-log');

  if (!codeView) throw new Error('Berry-Codeansicht fehlt');

  function selectView(simulator: boolean): void {
    codeView.classList.toggle('hidden', simulator);
    simulatorView.classList.toggle('hidden', !simulator);
    codeTab.classList.toggle('active', !simulator);
    simulatorTab.classList.toggle('active', simulator);
    title.textContent = simulator ? 'IO Simulator' : 'Berry Script';
    copyButton.classList.toggle('hidden', simulator);
    if (simulator) engine.syncWorkspace(workspace);
  }

  function renderInputs(snapshot: SimulatorSnapshot): void {
    inputGrid.replaceChildren();
    if (!snapshot.inputs.size) {
      inputGrid.append(emptyState('Eingangsblock hinzufügen'));
      return;
    }
    for (const [channel, active] of snapshot.inputs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `io-card${active ? ' active' : ''}`;
      button.setAttribute('aria-pressed', String(active));
      const actuator = document.createElement('span');
      actuator.className = 'push-button';
      button.append(actuator, label(channel, active ? 'HIGH' : 'LOW'));

      const press = (event: PointerEvent) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        engine.setInput(channel, true);
      };
      const release = (event: PointerEvent) => {
        event.preventDefault();
        engine.setInput(channel, false);
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('keydown', (event) => {
        if (event.key === ' ' || event.key === 'Enter') engine.setInput(channel, true);
      });
      button.addEventListener('keyup', (event) => {
        if (event.key === ' ' || event.key === 'Enter') engine.setInput(channel, false);
      });
      inputGrid.append(button);
    }
  }

  function outputCard(name: string, state: boolean | string, kind: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'io-card';
    const led = document.createElement('span');
    const stateName = typeof state === 'boolean' ? (state ? 'on' : 'off') : state;
    led.className = `led ${stateName}`;
    card.append(led, label(name, `${kind} · ${String(stateName).toUpperCase()}`));
    return card;
  }

  function renderOutputs(snapshot: SimulatorSnapshot): void {
    outputGrid.replaceChildren();
    for (const [channel, active] of snapshot.outputs) {
      outputGrid.append(outputCard(channel, active, 'Digitalausgang'));
    }
    for (const [name, state] of snapshot.signals) {
      outputGrid.append(outputCard(name, state, 'Signal'));
    }
    if (!snapshot.outputs.size && !snapshot.signals.size) {
      outputGrid.append(emptyState('Ausgangs- oder Signalblock hinzufügen'));
    }
  }

  function renderLog(snapshot: SimulatorSnapshot): void {
    logView.replaceChildren();
    const entries = snapshot.logs.slice(-20).reverse();
    if (!entries.length) {
      logView.append(emptyState('Noch keine Ereignisse'));
      return;
    }
    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = `sim-log-entry ${entry.level}`;
      const time = document.createElement('time');
      time.textContent = new Date(entry.timestamp).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const marker = document.createElement('i');
      const message = document.createElement('span');
      message.textContent = entry.message;
      row.append(time, marker, message);
      logView.append(row);
    }
  }

  engine.subscribe((snapshot) => {
    runButton.textContent = snapshot.running ? 'Stopp' : 'Start';
    runButton.classList.toggle('running', snapshot.running);
    stateDot.classList.toggle('running', snapshot.running);
    stateLabel.textContent = snapshot.running ? 'Läuft' : 'Bereit';
    cycleLabel.textContent = String(snapshot.cycleCount);
    renderInputs(snapshot);
    renderOutputs(snapshot);
    renderLog(snapshot);
  });

  codeTab.addEventListener('click', () => selectView(false));
  simulatorTab.addEventListener('click', () => selectView(true));
  runButton.addEventListener('click', () => {
    if (engine.snapshot().running) engine.stop();
    else engine.start();
  });
  resetButton.addEventListener('click', () => engine.reset());

  return {
    engine,
    sync: () => engine.syncWorkspace(workspace),
  };
}
