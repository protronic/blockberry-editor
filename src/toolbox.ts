import type * as Blockly from 'blockly/core';

/** Default toolbox focused on small PLC-style IoT workflows. */
export const blockBerryToolbox: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Mini-SPS',
      colour: '210',
      contents: [
        {kind: 'block', type: 'mini_sps_task'},
        {kind: 'block', type: 'sps_wait_ms'},
        {kind: 'block', type: 'sps_digital_input'},
        {kind: 'block', type: 'sps_digital_output'},
      ],
    },
    {
      kind: 'category',
      name: 'Eskalation',
      colour: '15',
      contents: [{kind: 'block', type: 'escalation_rule'}],
    },
    {
      kind: 'category',
      name: 'Signale & Monitoring',
      colour: '45',
      contents: [
        {kind: 'block', type: 'signal_set'},
        {kind: 'block', type: 'monitor_value'},
      ],
    },
    {
      kind: 'category',
      name: 'OD & CANopen',
      colour: '285',
      contents: [
        {kind: 'block', type: 'od_read'},
        {kind: 'block', type: 'od_write'},
        {kind: 'block', type: 'canopen_sdo_read'},
        {kind: 'block', type: 'canopen_sdo_write'},
        {kind: 'block', type: 'canopen_nmt'},
      ],
    },
    {
      kind: 'category',
      name: 'Sichere Anzeige',
      colour: '330',
      contents: [
        {kind: 'block', type: 'lvgl_set_text'},
        {kind: 'block', type: 'lvgl_set_visible'},
        {kind: 'block', type: 'lvgl_set_color'},
      ],
    },
    {
      kind: 'category',
      name: 'Logik',
      categorystyle: 'logic_category',
      contents: [
        {kind: 'block', type: 'controls_if'},
        {kind: 'block', type: 'controls_whileUntil'},
        {kind: 'block', type: 'logic_compare'},
        {kind: 'block', type: 'logic_operation'},
        {kind: 'block', type: 'logic_negate'},
        {kind: 'block', type: 'logic_boolean'},
        {kind: 'block', type: 'logic_null'},
      ],
    },
    {
      kind: 'category',
      name: 'Mathematik',
      categorystyle: 'math_category',
      contents: [
        {kind: 'block', type: 'math_number'},
        {kind: 'block', type: 'math_arithmetic'},
        {kind: 'block', type: 'math_change'},
      ],
    },
    {
      kind: 'category',
      name: 'Text',
      categorystyle: 'text_category',
      contents: [{kind: 'block', type: 'text'}],
    },
    {
      kind: 'category',
      name: 'Variablen',
      categorystyle: 'variable_category',
      custom: 'VARIABLE',
    },
  ],
};
