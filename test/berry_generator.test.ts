import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import {beforeAll, describe, expect, it} from 'vitest';
import {BerryGenerator, registerBlockBerryBlocks} from '../src/index.js';

beforeAll(() => {
  registerBlockBerryBlocks();
});

describe('BerryGenerator', () => {
  it('generates a cyclic Mini-SPS task with a stateful escalation', () => {
    const workspace = new Blockly.Workspace();
    const task = workspace.newBlock('mini_sps_task');
    task.setFieldValue('kuehlung', 'NAME');
    task.setFieldValue(250, 'INTERVAL');

    const escalation = workspace.newBlock('escalation_rule');
    escalation.setFieldValue('critical', 'LEVEL');
    escalation.setFieldValue(30, 'COOLDOWN');
    task.getInput('LOOP')!.connection!.connect(escalation.previousConnection!);

    const condition = workspace.newBlock('logic_boolean');
    condition.setFieldValue('TRUE', 'BOOL');
    escalation.getInput('CONDITION')!.connection!.connect(condition.outputConnection!);

    const message = workspace.newBlock('text');
    message.setFieldValue('Temperatur zu hoch', 'TEXT');
    escalation.getInput('MESSAGE')!.connection!.connect(message.outputConnection!);

    const signal = workspace.newBlock('signal_set');
    signal.setFieldValue('warnleuchte', 'SIGNAL');
    signal.setFieldValue('alarm', 'STATE');
    escalation.getInput('ON_TRIGGER')!.connection!.connect(signal.previousConnection!);

    const code = new BerryGenerator().workspaceToCode(workspace);

    expect(code).toContain('def kuehlung_cycle()');
    expect(code).toContain('escalation.raise_if(');
    expect(code).toContain('true, "critical", "Temperatur zu hoch", 30)');
    expect(code).toContain('signal.set("warnleuchte", "alarm")');
    expect(code).toContain('sps.every(250, kuehlung_cycle)');
  });

  it('quotes UI identifiers and rejects injected OD indexes', () => {
    const workspace = new Blockly.Workspace();
    const write = workspace.newBlock('od_write');
    write.setFieldValue('0x2000); evil()', 'INDEX');

    const number = workspace.newBlock('math_number');
    number.setFieldValue(42, 'NUM');
    write.getInput('VALUE')!.connection!.connect(number.outputConnection!);

    const ui = workspace.newBlock('lvgl_set_text');
    ui.setFieldValue('label"); evil("', 'WIDGET');
    write.nextConnection!.connect(ui.previousConnection!);

    const text = workspace.newBlock('text');
    text.setFieldValue('OK', 'TEXT');
    ui.getInput('TEXT')!.connection!.connect(text.outputConnection!);

    const code = new BerryGenerator().workspaceToCode(workspace);

    expect(code).toContain('od.write(0, 0, 42)');
    expect(code).toContain('ui.set_text("label\\"); evil(\\"", "OK")');
    expect(code).not.toContain('0x2000); evil()');
  });

  it('uses the Berry math module for powers', () => {
    const workspace = new Blockly.Workspace();
    const power = workspace.newBlock('math_arithmetic');
    power.setFieldValue('POWER', 'OP');
    const base = workspace.newBlock('math_number');
    base.setFieldValue(2, 'NUM');
    const exponent = workspace.newBlock('math_number');
    exponent.setFieldValue(8, 'NUM');
    power.getInput('A')!.connection!.connect(base.outputConnection!);
    power.getInput('B')!.connection!.connect(exponent.outputConnection!);

    const code = new BerryGenerator().workspaceToCode(workspace);

    expect(code).toContain('import math');
    expect(code).toContain('math.pow(2, 8)');
    expect(code).not.toContain('**');
  });
});
