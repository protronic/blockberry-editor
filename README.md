# BlockBerry Editor – Berry-Backend für Blockly

BlockBerry erzeugt Berry-Skripte für kleine IoT-Ablaufsteuerungen („Mini-SPS“)
und programmierbare Eskalationssysteme. Das Paket enthält den Generator, die
Domänenblöcke, eine fertige Toolbox und eine direkt nutzbare Weboberfläche. Die
nativen C-Bindings bleiben bewusst von der Webapp getrennt.

Der Generator leitet sich von Blocklys Lua-Generator ab, ersetzt aber die
Sprachsyntax vollständig durch Berry. So werden keine Lua-Konstrukte in Berry-
Programme übernommen.

## Umfang

- zyklische, nicht blockierende Mini-SPS-Tasks
- digitale Ein- und Ausgänge
- zustandsbehaftete Eskalation mit Stufe und Sperrzeit
- Signalisierung und Messwerterfassung
- ThingsBoard-Telemetrie, Geräteattribute und Alarm-Lifecycle
- lokales Object Dictionary sowie CANopen SDO/NMT
- eingeschränkte LVGL-Operationen ohne Rohcode oder frei wählbare Methoden
- Berry-Generatoren für die benötigten Blockly-Logik-, Mathematik-, Text- und
  Variablenblöcke

## Einbindung

### Webapp starten

```sh
bun install
bun run dev
```

Die Webapp bietet:

- Blockly-Arbeitsfläche mit einem Mini-SPS-Beispielprojekt
- Live-Vorschau des erzeugten Berry-Skripts
- automatische lokale Sicherung im Browser
- Import und Export von `.blockberry.json`-Projektdateien
- Export des generierten `.be`-Skripts
- konfigurierbaren HTTP-PUT-Upload an ein Gerät

Der Produktions-Build liegt nach `bun run build` in `dist/web`.

### Generator in einer eigenen Oberfläche

```ts
import * as Blockly from 'blockly';
import {
  berryGenerator,
  blockBerryToolbox,
  registerBlockBerryBlocks,
} from '@protronic/blockberry-editor';

registerBlockBerryBlocks();

const workspace = Blockly.inject('blockly', {
  toolbox: blockBerryToolbox,
});

const berrySource = berryGenerator.workspaceToCode(workspace);
```

## Runtime-Vertrag

Die generierten Skripte sprechen eine kleine, kontrollierte Binding-Schicht an:

```text
sps.every(interval_ms, callback)
sps.wait(duration_ms)
sps.input(channel)
sps.output(channel, value)

escalation.raise_if(rule_id, condition, level, message, cooldown_s)
signal.set(name, state)
monitor.record(metric, value, unit)

thingsboard.telemetry(key, value)
thingsboard.attribute(key, value)
thingsboard.alarm(type, severity, details)
thingsboard.clear_alarm(type)
thingsboard.connected()

od.read(index, subindex)
od.write(index, subindex, value)
canopen.sdo_read(node, index, subindex)
canopen.sdo_write(node, index, subindex, value)
canopen.nmt(node, command)

ui.set_text(widget_id, text)
ui.set_visible(widget_id, visible)
ui.set_color(widget_id, color)
```

Diese Namen sind die vorgesehene Grenze zu den nativen C-Modulen. Für Tasmota
kann die Implementierung dem Berry/LVGL-Mapping folgen, ohne dessen globale
LVGL-Objekte direkt für Blockly freizugeben. Insbesondere erzeugen die UI-Blöcke
nur drei freigegebene Operationen, quoten Widget-IDs und erlauben keinen
eingebetteten Berry-Code.

`escalation.raise_if` muss `true` nur bei einer neuen oder nach Ablauf der
Sperrzeit erneut zulässigen Eskalation liefern. Dadurch läuft der untergeordnete
„bei neuer Eskalation“-Zweig nicht in jedem SPS-Zyklus.

## Entwicklung

```sh
bun install
bun run check
```
