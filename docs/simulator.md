# Simulator-Architektur

## Zielbild

Zephyr wird nicht als Betriebssystem in den Browser kompiliert. Zephyrs
WebAssembly-Unterstützung bedeutet, dass WAMR **auf Zephyr** läuft und dort
WASM-Anwendungen ausführt. Für BlockBerry ist die passende symmetrische
Architektur:

```text
Browser                              Gerät
──────────────────────────           ──────────────────────────
BlockBerry Editor                    Zephyr RTOS
Berry VM (Emscripten/WASM)           Berry VM oder WAMR
simulierte Host-ABI                  native Host-ABI
Taster / LEDs / Uhr                  GPIO / Timer / CANopen
```

Das Berry-Skript und die Namen der Host-ABI bleiben auf beiden Seiten gleich.
Nur deren Implementierung wird ausgetauscht.

## Aktueller Stand

Die Webapp enthält einen sofort nutzbaren Simulator für den von BlockBerry
erzeugten Sprachumfang. Er führt die Blocksemantik zyklisch aus und modelliert:

- Mini-SPS-Tasks und Zykluszeiten
- digitale Eingänge als gedrückte Taster
- digitale Ausgänge und Signale als LEDs
- Variablen, Logik, Mathematik und begrenzte Schleifen
- nicht blockierende Warteblöcke
- Eskalationszustand und Sperrzeiten
- OD-Zugriffe sowie protokollierte CANopen-, UI- und ThingsBoard-Aufrufe

Der Simulator ist absichtlich kein vorgetäuschtes Zephyr-WASM. Die
Browser-Ausführung liegt in `web/simulator/engine.ts` hinter derselben
fachlichen Schnittstelle. Damit können UI und Ablaufmodell bereits getestet
werden, ohne eine nicht vorhandene Zephyr-Browserplattform zu behaupten.

## Berry-WASM-Stufe

Für die exakte Sprachsimulation wird der offizielle Berry-C-Interpreter mit
Emscripten als WASM-Modul gebaut. Das Modul benötigt native Funktionen für:

```text
bb_millis() -> i64
bb_input(channel_ptr, channel_len) -> i32
bb_output(channel_ptr, channel_len, value)
bb_signal(name_ptr, name_len, state_ptr, state_len)
bb_log(level, message_ptr, message_len)
bb_od_read(index, subindex) -> value
bb_od_write(index, subindex, value)
```

Die Berry-Module `sps`, `signal`, `escalation`, `monitor`, `thingsboard`, `od`,
`canopen` und `ui` werden in C registriert und rufen diese Imports auf. Das WASM
läuft in einem Web Worker, damit fehlerhafte Skripte die Editor-Oberfläche nicht
blockieren.

## Zephyr-Stufe

Auf dem Zielgerät implementiert ein Zephyr-Modul dieselbe Host-ABI:

- `bb_millis` über `k_uptime_get`
- `bb_input` und `bb_output` über Zephyr GPIO/DeviceTree-Aliase
- zyklische Ausführung über `k_work_delayable`
- CANopen über den ausgewählten Zephyr-CANopen-Stack
- Logausgabe über Zephyr Logging

Board, GPIO-Aliase und der konkrete CANopen-Stack gehören in ein separates
Firmware-Verzeichnis, sobald das Zielboard feststeht. Diese Auswahl ist
hardwareabhängig und kann nicht sinnvoll in der Webapp vorgegeben werden.

## Sicherheitsgrenzen

- maximal 100 Schleifendurchläufe pro SPS-Zyklus im Browser-Simulator
- maximal 500 Anweisungen pro Ablaufkette
- keine Netzwerkanfragen durch simulierte ThingsBoard-Blöcke
- keine frei wählbaren LVGL-Methoden oder Rohcode-Blöcke
- eine spätere Berry-WASM-VM läuft in einem Worker und erhält nur freigegebene
  Host-Funktionen
