import * as Blockly from 'blockly/core';

const definitions = Blockly.common.createBlockDefinitionsFromJsonArray([
  {
    type: 'mini_sps_task',
    message0: 'Mini-SPS %1 Zyklus %2 ms',
    args0: [
      {type: 'field_input', name: 'NAME', text: 'steuerung'},
      {type: 'field_number', name: 'INTERVAL', value: 100, min: 10, precision: 1},
    ],
    message1: 'Initialisierung %1',
    args1: [{type: 'input_statement', name: 'INIT'}],
    message2: 'Zyklus %1',
    args2: [{type: 'input_statement', name: 'LOOP'}],
    colour: 210,
    tooltip: 'Registriert eine nicht blockierende, zyklische Ablaufsteuerung.',
  },
  {
    type: 'sps_wait_ms',
    message0: 'Ablauf für %1 ms sperren',
    args0: [{type: 'input_value', name: 'DURATION', check: 'Number'}],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
    tooltip: 'Überspringt diesen Ablauf bis zum Ende der Wartezeit.',
  },
  {
    type: 'sps_digital_input',
    message0: 'Eingang %1',
    args0: [{type: 'field_input', name: 'CHANNEL', text: 'DI1'}],
    output: 'Boolean',
    colour: 210,
  },
  {
    type: 'sps_digital_output',
    message0: 'Ausgang %1 auf %2',
    args0: [
      {type: 'field_input', name: 'CHANNEL', text: 'DO1'},
      {type: 'input_value', name: 'VALUE', check: 'Boolean'},
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 210,
  },
  {
    type: 'escalation_rule',
    message0: 'Wenn %1 eskalieren als %2',
    args0: [
      {type: 'input_value', name: 'CONDITION', check: 'Boolean'},
      {
        type: 'field_dropdown',
        name: 'LEVEL',
        options: [
          ['Info', 'info'],
          ['Warnung', 'warning'],
          ['Alarm', 'alarm'],
          ['Kritisch', 'critical'],
        ],
      },
    ],
    message1: 'Meldung %1 Sperrzeit %2 s',
    args1: [
      {type: 'input_value', name: 'MESSAGE', check: 'String'},
      {type: 'field_number', name: 'COOLDOWN', value: 60, min: 0, precision: 1},
    ],
    message2: 'bei neuer Eskalation %1',
    args2: [{type: 'input_statement', name: 'ON_TRIGGER'}],
    previousStatement: null,
    nextStatement: null,
    colour: 15,
    tooltip: 'Löst zustandsbehaftet und mit Sperrzeit aus; Wiederholungen werden unterdrückt.',
  },
  {
    type: 'signal_set',
    message0: 'Signal %1 Zustand %2',
    args0: [
      {type: 'field_input', name: 'SIGNAL', text: 'status'},
      {
        type: 'field_dropdown',
        name: 'STATE',
        options: [
          ['aus', 'off'],
          ['normal', 'normal'],
          ['Warnung', 'warning'],
          ['Alarm', 'alarm'],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 45,
  },
  {
    type: 'monitor_value',
    message0: 'Messwert %1 = %2 Einheit %3',
    args0: [
      {type: 'field_input', name: 'METRIC', text: 'temperature'},
      {type: 'input_value', name: 'VALUE'},
      {type: 'field_input', name: 'UNIT', text: '°C'},
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 45,
  },
  {
    type: 'thingsboard_telemetry',
    message0: 'ThingsBoard Telemetrie %1 = %2',
    args0: [
      {type: 'field_input', name: 'KEY', text: 'temperature'},
      {type: 'input_value', name: 'VALUE'},
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 185,
    tooltip: 'Sendet einen Zeitreihenwert an ThingsBoard.',
  },
  {
    type: 'thingsboard_attribute',
    message0: 'ThingsBoard Attribut %1 = %2',
    args0: [
      {type: 'field_input', name: 'KEY', text: 'firmware'},
      {type: 'input_value', name: 'VALUE'},
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 185,
    tooltip: 'Veröffentlicht ein clientseitiges Geräteattribut.',
  },
  {
    type: 'thingsboard_alarm_create',
    message0: 'ThingsBoard Alarm %1 Stufe %2',
    args0: [
      {type: 'field_input', name: 'ALARM_TYPE', text: 'Grenzwert'},
      {
        type: 'field_dropdown',
        name: 'SEVERITY',
        options: [
          ['Info', 'INDETERMINATE'],
          ['Warnung', 'WARNING'],
          ['Leicht', 'MINOR'],
          ['Schwer', 'MAJOR'],
          ['Kritisch', 'CRITICAL'],
        ],
      },
    ],
    message1: 'Details %1',
    args1: [{type: 'input_value', name: 'DETAILS', check: 'String'}],
    previousStatement: null,
    nextStatement: null,
    colour: 185,
    tooltip: 'Erzeugt oder aktualisiert einen Alarm gleichen Typs.',
  },
  {
    type: 'thingsboard_alarm_clear',
    message0: 'ThingsBoard Alarm %1 aufheben',
    args0: [{type: 'field_input', name: 'ALARM_TYPE', text: 'Grenzwert'}],
    previousStatement: null,
    nextStatement: null,
    colour: 185,
  },
  {
    type: 'thingsboard_connected',
    message0: 'ThingsBoard verbunden',
    output: 'Boolean',
    colour: 185,
  },
  {
    type: 'od_read',
    message0: 'OD lesen Index %1 Subindex %2',
    args0: [
      {type: 'field_input', name: 'INDEX', text: '0x2000'},
      {type: 'field_number', name: 'SUBINDEX', value: 0, min: 0, max: 255, precision: 1},
    ],
    output: null,
    colour: 275,
  },
  {
    type: 'od_write',
    message0: 'OD schreiben Index %1 Subindex %2 Wert %3',
    args0: [
      {type: 'field_input', name: 'INDEX', text: '0x2000'},
      {type: 'field_number', name: 'SUBINDEX', value: 0, min: 0, max: 255, precision: 1},
      {type: 'input_value', name: 'VALUE'},
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 275,
  },
  {
    type: 'canopen_sdo_read',
    message0: 'CANopen SDO lesen Knoten %1 Index %2 Subindex %3',
    args0: [
      {type: 'field_number', name: 'NODE', value: 1, min: 1, max: 127, precision: 1},
      {type: 'field_input', name: 'INDEX', text: '0x2000'},
      {type: 'field_number', name: 'SUBINDEX', value: 0, min: 0, max: 255, precision: 1},
    ],
    output: null,
    colour: 290,
  },
  {
    type: 'canopen_sdo_write',
    message0: 'CANopen SDO schreiben Knoten %1 Index %2 Subindex %3 Wert %4',
    args0: [
      {type: 'field_number', name: 'NODE', value: 1, min: 1, max: 127, precision: 1},
      {type: 'field_input', name: 'INDEX', text: '0x2000'},
      {type: 'field_number', name: 'SUBINDEX', value: 0, min: 0, max: 255, precision: 1},
      {type: 'input_value', name: 'VALUE'},
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 290,
  },
  {
    type: 'canopen_nmt',
    message0: 'CANopen Knoten %1 %2',
    args0: [
      {type: 'field_number', name: 'NODE', value: 1, min: 0, max: 127, precision: 1},
      {
        type: 'field_dropdown',
        name: 'COMMAND',
        options: [
          ['starten', 'start'],
          ['stoppen', 'stop'],
          ['Pre-Operational', 'pre_operational'],
          ['zurücksetzen', 'reset'],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 290,
  },
  {
    type: 'lvgl_set_text',
    message0: 'Anzeige %1 Text %2',
    args0: [
      {type: 'field_input', name: 'WIDGET', text: 'status_label'},
      {type: 'input_value', name: 'TEXT'},
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 330,
    tooltip: 'Sicherer UI-Aufruf: kein frei wählbarer Methodenname und kein Rohcode.',
  },
  {
    type: 'lvgl_set_visible',
    message0: 'Anzeige %1 sichtbar %2',
    args0: [
      {type: 'field_input', name: 'WIDGET', text: 'alarm_icon'},
      {type: 'input_value', name: 'VISIBLE', check: 'Boolean'},
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 330,
  },
  {
    type: 'lvgl_set_color',
    message0: 'Anzeige %1 Farbe %2',
    args0: [
      {type: 'field_input', name: 'WIDGET', text: 'status_label'},
      {
        type: 'field_dropdown',
        name: 'COLOR',
        options: [
          ['grün', 'green'],
          ['gelb', 'yellow'],
          ['rot', 'red'],
          ['grau', 'gray'],
        ],
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 330,
  },
]);

/** Registers BlockBerry's domain blocks in the active Blockly registry. */
export function registerBlockBerryBlocks(): void {
  Blockly.common.defineBlocks(definitions);
}

export {definitions as blockDefinitions};
