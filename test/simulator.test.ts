import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import {beforeAll, describe, expect, it} from 'bun:test';
import {registerBlockBerryBlocks} from '../src/index.js';
import {BlockBerrySimulator} from '../web/simulator/engine.ts';

beforeAll(() => {
  registerBlockBerryBlocks();
});

describe('BlockBerrySimulator', () => {
  it('maps an input button to a cyclic digital output', async () => {
    const workspace = new Blockly.Workspace();
    const task = workspace.newBlock('mini_sps_task');
    task.setFieldValue(10, 'INTERVAL');

    const output = workspace.newBlock('sps_digital_output');
    output.setFieldValue('LED1', 'CHANNEL');
    task.getInput('LOOP')!.connection!.connect(output.previousConnection!);

    const input = workspace.newBlock('sps_digital_input');
    input.setFieldValue('BUTTON1', 'CHANNEL');
    output.getInput('VALUE')!.connection!.connect(input.outputConnection!);

    const simulator = new BlockBerrySimulator(workspace);
    simulator.setInput('BUTTON1', true);
    simulator.start();
    await new Promise((resolve) => setTimeout(resolve, 25));

    const running = simulator.snapshot();
    expect(running.running).toBe(true);
    expect(running.inputs.get('BUTTON1')).toBe(true);
    expect(running.outputs.get('LED1')).toBe(true);
    expect(running.cycleCount).toBeGreaterThan(0);

    simulator.setInput('BUTTON1', false);
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(simulator.snapshot().outputs.get('LED1')).toBe(false);
    simulator.stop();
  });
});
