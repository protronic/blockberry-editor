# BlockBerry Zephyr Demo

Diese eigenständige Zephyr-Anwendung bettet Berry 1.1 ein und stellt eine
zeilenbasierte REPL über zwei Ports bereit:

- UART/stdin für lokale Tests und `native_sim`
- Bluetooth LE mit den Nordic-UART-Service-UUIDs für STM32WBA

Die Berry-VM läuft ausschließlich im Hauptthread. UART- und BLE-Callbacks
stellen vollständige Zeilen in eine Message Queue. Dadurch greifen die
Transport-Callbacks nie gleichzeitig auf die VM zu.

## Abhängigkeiten einrichten

Aus dem Repository-Stamm:

```sh
python3 -m pip install --user west
west init -l blockberry-zephyr-demo
west update
west zephyr-export
python3 -m pip install --user -r zephyr/scripts/requirements.txt
```

Das Manifest pinnt Zephyr 4.4.1 und Berry 1.1.0. Berry wird beim Konfigurieren
direkt aus `modules/lib/berry` in die Zephyr-Anwendung kompiliert.

## Host-Demo

```sh
west build -d build-native -b native_sim/native/64 \
  blockberry-zephyr-demo -- \
  -DEXTRA_CONF_FILE=configs/host.conf

bun blockberry-zephyr-demo/tools/ws-bridge.ts \
  --firmware build-native/zephyr/zephyr.exe
```

Die Bridge startet den `native_sim`-Prozess und veröffentlicht dessen
stdin/stdout unter:

```text
ws://localhost:8765/repl
```

In der BlockBerry-Webapp **Berry REPL → Host WebSocket** auswählen.

## STM32WBA-Port

Zephyr 4.4.1 besitzt fertige Targets für WBA55 und WBA65:

```sh
west blobs fetch hal_stm32

west build -d build-wba55 -b nucleo_wba55cg/stm32wba55xx \
  blockberry-zephyr-demo -- \
  -DEXTRA_CONF_FILE=configs/ble.conf

west build -d build-wba65 -b nucleo_wba65ri/stm32wba65xx \
  blockberry-zephyr-demo -- \
  -DEXTRA_CONF_FILE=configs/ble.conf
```

Danach mit dem zum Board passenden Runner flashen:

```sh
west flash -d build-wba55
```

Der neue **STM32WBA5MMG** enthält einen STM32WBA55UG. Zephyr führt in 4.4.1
noch kein fertiges Board für ein konkretes WBA5MMG-Carrier-Design. Die
Anwendung selbst ist SoC-unabhängig; für ein Produktboard muss eine
Boarddefinition mit dessen Flash-Aufteilung, Quarzen und UART-/GPIO-Pins
ergänzt werden. Als Referenz dient `nucleo_wba55cg/stm32wba55xx`.

Ein Produkt beziehungsweise Zephyr-Target namens **STM32WBA6MM** ist derzeit
nicht dokumentiert. Für die WBA6-Familie wird deshalb der vorhandene
STM32WBA65-Port als Referenz verwendet. Eine erfundene `wba6mm`-Board-ID ist
bewusst nicht enthalten.

## BLE GATT/NUS

| Funktion | UUID | Zugriff |
|---|---|---|
| Service | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | Primary Service |
| RX | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` | Write / Write Without Response |
| TX | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` | Notify |

Die Webapp verwendet Web Bluetooth, sucht nach der Service-UUID, schreibt
REPL-Befehle in RX und abonniert TX.

`configs/ble.conf` lässt unverschlüsselte Verbindungen für lokale Experimente
zu. Das ist nicht für ein ausgeliefertes Produkt geeignet. Dafür mindestens:

```text
CONFIG_BT_SMP=y
CONFIG_BT_SETTINGS=y
CONFIG_BLOCKBERRY_NUS_REQUIRE_ENCRYPTION=y
```

Zusätzlich muss die REPL in einem Produkt deaktivierbar sein und eine
Autorisierung erhalten.

## REPL verwenden

Die Demo registriert drei native Funktionen:

```berry
1 + 2
millis()
led(true)
led(false)
button()
```

Die GPIO-Funktionen verwenden die Devicetree-Aliase `led0` und `sw0`. Fehlen
die Aliase, meldet Berry einen `io_error`.

Die Demo akzeptiert aktuell einzelne Befehlszeilen bis 255 Byte. Mehrzeilige
Funktions- oder Klassendefinitionen sind noch nicht Bestandteil dieses
Spielports.
