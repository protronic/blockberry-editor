# BlockBerry Zephyr Demo

Diese eigenständige Zephyr-Anwendung bettet Berry 1.1 ein und stellt eine
zeilenbasierte REPL über zwei Ports bereit:

- UART/stdin für lokale Tests und `native_sim`
- Bluetooth LE mit den Nordic-UART-Service-UUIDs für STM32WB/WBA

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

## STM32WB5MM- und STM32WBA65-Ports

Die Anwendung nutzt zwei getrennte, offiziell dokumentierte Zephyr-Targets.

Für das STM32WB5MM-DK:

```sh
west build -d build-wb5mm -b stm32wb5mm_dk/stm32wb55xx \
  blockberry-zephyr-demo -- \
  -DEXTRA_CONF_FILE=configs/ble.conf
```

Für ein Carrier-Design mit dem reinen STM32WB5MMG-Modul:

```sh
west build -d build-wb5mmg -b stm32wb5mmg/stm32wb55xx \
  blockberry-zephyr-demo -- \
  -DEXTRA_CONF_FILE=configs/ble.conf
```

Der Cortex-M0+-Funkkern des STM32WB5MMG muss vorher mit einer kompatiblen
STM32WB-**HCI-Layer**-Coprocessor-Binary programmiert werden. Neuere
„Full Stack“-Binaries sind laut Zephyr-Dokumentation nicht kompatibel.

Für das STM32WBA65I-DK1:

```sh
west blobs fetch hal_stm32

west build -d build-wba65 -b stm32wba65i_dk1/stm32wba65xx \
  blockberry-zephyr-demo -- \
  -DEXTRA_CONF_FILE=configs/ble.conf
```

Danach mit dem zum Board passenden Runner flashen:

```sh
west flash -d build-wb5mm
west flash -d build-wba65
```

Das WBA65I-DK1 besitzt die Aliase `led0` und `sw0`, sodass `led()` und
`button()` direkt funktionieren. Beim reinen WB5MMG-Modultarget hängen diese
Funktionen von den Aliasen des Carrier-Devicetrees ab. Die BLE-REPL ist davon
unabhängig.

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
Spielports. Das Berry-Mathematikmodul ist in diesem kleinen Build deaktiviert;
Grundrechenarten funktionieren, `import math` jedoch nicht.
