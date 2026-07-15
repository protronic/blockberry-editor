import type {Block, Workspace} from 'blockly/core';

export type SimulatorLogLevel = 'info' | 'io' | 'warning' | 'error';

export type SimulatorLogEntry = {
  id: number;
  timestamp: number;
  level: SimulatorLogLevel;
  message: string;
};

export type SimulatorSnapshot = {
  running: boolean;
  cycleCount: number;
  inputs: ReadonlyMap<string, boolean>;
  outputs: ReadonlyMap<string, boolean>;
  signals: ReadonlyMap<string, string>;
  logs: readonly SimulatorLogEntry[];
};

type TaskContext = {
  name: string;
};

type EscalationState = {
  active: boolean;
  lastTrigger: number;
};

export class BlockBerrySimulator {
  private readonly inputs = new Map<string, boolean>();
  private readonly outputs = new Map<string, boolean>();
  private readonly signals = new Map<string, string>();
  private readonly variables = new Map<string, unknown>();
  private readonly objectDictionary = new Map<string, unknown>();
  private readonly escalationStates = new Map<string, EscalationState>();
  private readonly waitDeadlines = new Map<string, number>();
  private readonly listeners = new Set<(snapshot: SimulatorSnapshot) => void>();
  private readonly timers = new Set<ReturnType<typeof setInterval>>();
  private logs: SimulatorLogEntry[] = [];
  private workspace: Workspace;
  private running = false;
  private cycleCount = 0;
  private logSequence = 0;

  constructor(workspace: Workspace) {
    this.workspace = workspace;
    this.syncWorkspace(workspace);
  }

  subscribe(listener: (snapshot: SimulatorSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): SimulatorSnapshot {
    return {
      running: this.running,
      cycleCount: this.cycleCount,
      inputs: new Map(this.inputs),
      outputs: new Map(this.outputs),
      signals: new Map(this.signals),
      logs: [...this.logs],
    };
  }

  syncWorkspace(workspace = this.workspace): void {
    this.workspace = workspace;
    const inputNames = this.channels('sps_digital_input', 'CHANNEL');
    const outputNames = this.channels('sps_digital_output', 'CHANNEL');
    const signalNames = this.channels('signal_set', 'SIGNAL');
    this.reconcile(this.inputs, inputNames, false);
    this.reconcile(this.outputs, outputNames, false);
    this.reconcile(this.signals, signalNames, 'off');
    this.notify();
  }

  start(): void {
    this.stop(false);
    this.running = true;
    this.cycleCount = 0;
    this.waitDeadlines.clear();
    this.escalationStates.clear();
    this.log('info', 'Berry-Simulation gestartet');

    const tasks = this.workspace
      .getTopBlocks(true)
      .filter((block) => block.type === 'mini_sps_task');

    for (const task of tasks) {
      const context = {name: String(task.getFieldValue('NAME') || 'task')};
      this.executeChain(task.getInputTargetBlock('INIT'), context);
      const interval = Math.max(10, Number(task.getFieldValue('INTERVAL')) || 100);
      const timer = globalThis.setInterval(() => {
        if (!this.running) return;
        this.cycleCount += 1;
        this.executeChain(task.getInputTargetBlock('LOOP'), context);
        this.notify();
      }, interval);
      this.timers.add(timer);
    }

    if (!tasks.length) this.log('warning', 'Kein Mini-SPS-Task im Arbeitsbereich');
    this.notify();
  }

  stop(writeLog = true): void {
    for (const timer of this.timers) globalThis.clearInterval(timer);
    this.timers.clear();
    const wasRunning = this.running;
    this.running = false;
    if (writeLog && wasRunning) this.log('info', 'Simulation angehalten');
    this.notify();
  }

  reset(): void {
    this.stop(false);
    this.cycleCount = 0;
    this.variables.clear();
    this.objectDictionary.clear();
    this.escalationStates.clear();
    this.waitDeadlines.clear();
    this.logs = [];
    for (const key of this.inputs.keys()) this.inputs.set(key, false);
    for (const key of this.outputs.keys()) this.outputs.set(key, false);
    for (const key of this.signals.keys()) this.signals.set(key, 'off');
    this.log('info', 'Simulation zurückgesetzt');
    this.notify();
  }

  setInput(channel: string, active: boolean): void {
    if (!this.inputs.has(channel) || this.inputs.get(channel) === active) return;
    this.inputs.set(channel, active);
    this.log('io', `${channel} = ${active ? 'EIN' : 'AUS'}`);
    this.notify();
  }

  private channels(type: string, field: string): Set<string> {
    return new Set(
      this.workspace
        .getAllBlocks(false)
        .filter((block) => block.type === type)
        .map((block) => String(block.getFieldValue(field) ?? '').trim())
        .filter(Boolean),
    );
  }

  private reconcile<T>(target: Map<string, T>, names: Set<string>, initial: T): void {
    for (const key of target.keys()) {
      if (!names.has(key)) target.delete(key);
    }
    for (const name of names) {
      if (!target.has(name)) target.set(name, initial);
    }
  }

  private executeChain(block: Block | null, context: TaskContext): boolean {
    let current = block;
    let guard = 0;
    while (current && guard++ < 500) {
      if (this.executeStatement(current, context)) return true;
      current = current.getNextBlock();
    }
    if (guard >= 500) this.log('error', `Ablauf ${context.name}: Anweisungslimit erreicht`);
    return false;
  }

  /** Returns true when execution should pause for this cycle. */
  private executeStatement(block: Block, context: TaskContext): boolean {
    switch (block.type) {
      case 'variables_set':
        this.variables.set(
          String(block.getFieldValue('VAR')),
          this.evaluate(block.getInputTargetBlock('VALUE')),
        );
        return false;
      case 'math_change': {
        const key = String(block.getFieldValue('VAR'));
        const current = Number(this.variables.get(key)) || 0;
        this.variables.set(key, current + Number(this.evaluate(block.getInputTargetBlock('DELTA'))));
        return false;
      }
      case 'controls_if': {
        let index = 0;
        while (block.getInput(`IF${index}`)) {
          if (Boolean(this.evaluate(block.getInputTargetBlock(`IF${index}`)))) {
            return this.executeChain(block.getInputTargetBlock(`DO${index}`), context);
          }
          index += 1;
        }
        return this.executeChain(block.getInputTargetBlock('ELSE'), context);
      }
      case 'controls_whileUntil': {
        const until = block.getFieldValue('MODE') === 'UNTIL';
        let iterations = 0;
        while (iterations++ < 100) {
          const condition = Boolean(this.evaluate(block.getInputTargetBlock('BOOL')));
          if ((until && condition) || (!until && !condition)) break;
          if (this.executeChain(block.getInputTargetBlock('DO'), context)) return true;
        }
        if (iterations >= 100) this.log('warning', 'Schleife nach 100 Durchläufen begrenzt');
        return false;
      }
      case 'sps_wait_ms': {
        const now = performance.now();
        const deadline = this.waitDeadlines.get(block.id);
        if (deadline === undefined) {
          const duration = Math.max(0, Number(this.evaluate(block.getInputTargetBlock('DURATION'))));
          this.waitDeadlines.set(block.id, now + duration);
          return true;
        }
        if (now < deadline) return true;
        this.waitDeadlines.delete(block.id);
        return false;
      }
      case 'sps_digital_output': {
        const channel = String(block.getFieldValue('CHANNEL') ?? '');
        const next = Boolean(this.evaluate(block.getInputTargetBlock('VALUE')));
        if (this.outputs.get(channel) !== next) {
          this.outputs.set(channel, next);
          this.log('io', `${channel} → ${next ? 'EIN' : 'AUS'}`);
        }
        return false;
      }
      case 'signal_set': {
        const signal = String(block.getFieldValue('SIGNAL') ?? '');
        const state = String(block.getFieldValue('STATE') ?? 'off');
        if (this.signals.get(signal) !== state) {
          this.signals.set(signal, state);
          this.log('io', `${signal} → ${state}`);
        }
        return false;
      }
      case 'escalation_rule': {
        const condition = Boolean(this.evaluate(block.getInputTargetBlock('CONDITION')));
        const previous = this.escalationStates.get(block.id) ?? {
          active: false,
          lastTrigger: Number.NEGATIVE_INFINITY,
        };
        const cooldown = Math.max(0, Number(block.getFieldValue('COOLDOWN')) || 0) * 1000;
        const now = performance.now();
        const shouldTrigger =
          condition && (!previous.active || now - previous.lastTrigger >= cooldown);
        this.escalationStates.set(block.id, {
          active: condition,
          lastTrigger: shouldTrigger ? now : previous.lastTrigger,
        });
        if (shouldTrigger) {
          const level = String(block.getFieldValue('LEVEL') ?? 'warning');
          const message = String(this.evaluate(block.getInputTargetBlock('MESSAGE')) ?? '');
          this.log(level === 'critical' || level === 'alarm' ? 'error' : 'warning', message);
          return this.executeChain(block.getInputTargetBlock('ON_TRIGGER'), context);
        }
        return false;
      }
      case 'monitor_value':
        this.log(
          'info',
          `${block.getFieldValue('METRIC')}: ${String(this.evaluate(block.getInputTargetBlock('VALUE')))} ${block.getFieldValue('UNIT') ?? ''}`,
        );
        return false;
      case 'thingsboard_telemetry':
        this.log(
          'info',
          `ThingsBoard: ${block.getFieldValue('KEY')} = ${String(this.evaluate(block.getInputTargetBlock('VALUE')))}`,
        );
        return false;
      case 'thingsboard_attribute':
        this.log(
          'info',
          `ThingsBoard-Attribut: ${block.getFieldValue('KEY')} = ${String(this.evaluate(block.getInputTargetBlock('VALUE')))}`,
        );
        return false;
      case 'thingsboard_alarm_create':
        this.log(
          'warning',
          `ThingsBoard-Alarm ${block.getFieldValue('ALARM_TYPE')} (${block.getFieldValue('SEVERITY')}): ${String(this.evaluate(block.getInputTargetBlock('DETAILS')))}`,
        );
        return false;
      case 'thingsboard_alarm_clear':
        this.log('info', `ThingsBoard-Alarm ${block.getFieldValue('ALARM_TYPE')} aufgehoben`);
        return false;
      case 'od_write': {
        const key = `${block.getFieldValue('INDEX')}:${block.getFieldValue('SUBINDEX')}`;
        this.objectDictionary.set(key, this.evaluate(block.getInputTargetBlock('VALUE')));
        return false;
      }
      case 'canopen_nmt':
      case 'canopen_sdo_write':
      case 'lvgl_set_text':
      case 'lvgl_set_visible':
      case 'lvgl_set_color':
        this.log('info', `${block.type} ausgeführt`);
        return false;
      default:
        return false;
    }
  }

  private evaluate(block: Block | null): unknown {
    if (!block) return null;
    switch (block.type) {
      case 'logic_boolean':
        return block.getFieldValue('BOOL') === 'TRUE';
      case 'logic_null':
        return null;
      case 'math_number':
        return Number(block.getFieldValue('NUM')) || 0;
      case 'text':
        return String(block.getFieldValue('TEXT') ?? '');
      case 'variables_get':
        return this.variables.get(String(block.getFieldValue('VAR'))) ?? null;
      case 'logic_negate':
        return !Boolean(this.evaluate(block.getInputTargetBlock('BOOL')));
      case 'logic_compare': {
        const left = this.evaluate(block.getInputTargetBlock('A'));
        const right = this.evaluate(block.getInputTargetBlock('B'));
        switch (block.getFieldValue('OP')) {
          case 'NEQ': return left !== right;
          case 'LT': return Number(left) < Number(right);
          case 'LTE': return Number(left) <= Number(right);
          case 'GT': return Number(left) > Number(right);
          case 'GTE': return Number(left) >= Number(right);
          default: return left === right;
        }
      }
      case 'logic_operation': {
        const left = Boolean(this.evaluate(block.getInputTargetBlock('A')));
        return block.getFieldValue('OP') === 'AND'
          ? left && Boolean(this.evaluate(block.getInputTargetBlock('B')))
          : left || Boolean(this.evaluate(block.getInputTargetBlock('B')));
      }
      case 'math_arithmetic': {
        const left = Number(this.evaluate(block.getInputTargetBlock('A'))) || 0;
        const right = Number(this.evaluate(block.getInputTargetBlock('B'))) || 0;
        switch (block.getFieldValue('OP')) {
          case 'MINUS': return left - right;
          case 'MULTIPLY': return left * right;
          case 'DIVIDE': return right === 0 ? Number.NaN : left / right;
          case 'POWER': return Math.pow(left, right);
          default: return left + right;
        }
      }
      case 'sps_digital_input':
        return this.inputs.get(String(block.getFieldValue('CHANNEL') ?? '')) ?? false;
      case 'od_read': {
        const key = `${block.getFieldValue('INDEX')}:${block.getFieldValue('SUBINDEX')}`;
        return this.objectDictionary.get(key) ?? 0;
      }
      case 'canopen_sdo_read':
        return 0;
      case 'thingsboard_connected':
        return true;
      default:
        return null;
    }
  }

  private log(level: SimulatorLogLevel, message: string): void {
    this.logs = [
      ...this.logs.slice(-79),
      {
        id: ++this.logSequence,
        timestamp: Date.now(),
        level,
        message: message || '(keine Meldung)',
      },
    ];
  }

  private notify(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
