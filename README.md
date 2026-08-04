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
- Umgebungssensor (Bereitschaft, Temperatur, Druck, Feuchte)
- zustandsbehaftete Eskalation mit Stufe und Sperrzeit
- Signalisierung und Messwerterfassung
- ThingsBoard-Telemetrie, Geräteattribute und Alarm-Lifecycle
- lokales Object Dictionary sowie CANopen SDO/NMT
- eingeschränkte LVGL-Operationen ohne Rohcode oder frei wählbare Methoden
- Debug-Ausgabe über `log.print`
- Berry-Generatoren für die benötigten Blockly-Logik-, Mathematik-, Text- und
  Variablenblöcke

## Einbindung

### OpenCloud-Webapp

Die Oberfläche ist als native OpenCloud-Dateiapp auf Basis des
[`web-app-skeleton`](https://github.com/opencloud-eu/web-app-skeleton) aufgebaut.
Sie registriert sich für JSON-Dateien und lädt bzw. speichert das
`blockberry`-Projektformat über den OpenCloud `AppWrapperRoute`.

Die App bietet:

- Öffnen und Speichern von `.blockberry.json`-Projektdateien in OpenCloud
- OpenCloud-Autosave, Speichern unter, Konfliktprüfung und Schreibschutz
- Blockly-Arbeitsfläche mit einem Mini-SPS-Beispielprojekt
- Geräteprofile aus CouchDB über das OpenCloud-Access-Token (Client `web`, kein Extra-Keycloak-Login)
- Textvorschau des erzeugten `.be`-Berry-Skripts
- Download des generierten `.be`-Skripts

```sh
pnpm install
pnpm run dev
```

`pnpm run dev` erzeugt einen Development-Build im Watch-Modus. Dieser wird wie
im OpenCloud-Webapp-Skeleton beschrieben in einer lokalen OpenCloud-Instanz
registriert. Der Produktions-Build liegt nach `pnpm run build` in `dist/web`;
die wiederverwendbare Generatorbibliothek liegt in `dist/lib`.

#### Smoke-Test der OpenCloud-Integration

`test/harness` stellt `src/App.vue` so bereit, wie der OpenCloud `AppWrapper`
die Komponente einbindet (Dateiinhalt als `currentContent`-Prop, Autosave über
`update:currentContent`). Damit lässt sich das Lade- und Speicherverhalten ohne
laufende OpenCloud-Instanz im Browser prüfen:

```sh
pnpm exec vite --config vite.harness.config.ts   # Dev-Server auf Port 5199
node test/harness/run-harness.mjs all            # Szenarien mit Assertions
```

Szenarien: `existing` (Datei öffnen), `late` (Inhalt kommt nach dem Mount),
`empty` (neue leere Datei → Starterprojekt), `probe` (rohe Blockly-Lade-Matrix
ohne Assertions). Der Runner erwartet ein Chromium unter
`/opt/pw-browsers/chromium` oder in `HARNESS_CHROMIUM`.

### Cloud (Keycloak + CouchDB) / Standalone-Webapp

Zusätzlich gibt es unter `web/` eine Standalone-Oberfläche mit Keycloak-Login
und CouchDB-Speicherung für Projekte und Geräteprofile.

Die Webapp meldet sich per OpenID Connect (PKCE) an Keycloak an und speichert
Projekte als Dokumente in CouchDB (`Authorization: Bearer …`).

Defaults (überschreibbar per `.env`, siehe `.env.example`):

| Variable | Default |
|----------|---------|
| `VITE_KEYCLOAK_URL` | `https://keycloak.protronic-gmbh.de` |
| `VITE_KEYCLOAK_REALM` | `openCloud` |
| `VITE_KEYCLOAK_CLIENT_ID` | `blockberry-editor-client` |
| `VITE_COUCH_URL` | `https://couch.protronic-gmbh.de/couchdb` |
| `VITE_COUCH_DB` | `blockberry-projects` |
| `VITE_COUCH_PROFILES_DB` | `bockberry-profiles` |

Geräteprofile werden nach dem Login ausschließlich aus `VITE_COUCH_PROFILES_DB`
geladen. Ein Profil-Dokument braucht mindestens `name` und `blocks` (Id = `id`
oder `_id`, z. B. `pico_telemetry_v1`). Seed-Beispiel:
`scripts/seed-pico-telemetry-profile.json`.

Am Keycloak-Client müssen **Valid redirect URIs** und **Web origins** die
Editor-URL enthalten:

- Valid redirect URIs: `http://localhost:5173/*` (plus Prod-URL)
- Web origins: `http://localhost:5173` oder `+` (übernimmt Origins aus den Redirect-URIs)

Ohne **Web origins** liefert der Token-Endpoint oft **403 ohne CORS-Header** —
der Browser meldet das als CORS-Fehler. Client sollte **public** sein
(Client authentication aus), Standard flow an, PKCE S256.

CouchDB braucht CORS für dieselbe Origin sowie JWT-Auth mit Claim `_couchdb.roles`.

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

sensor.ready()
sensor.temp()
sensor.pressure()
sensor.humidity()

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

log.print(message)
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
pnpm install
pnpm run check
```
