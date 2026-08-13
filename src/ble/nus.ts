/** Nordic UART Service (NUS) — same UUIDs as BLEberry / BLEserial. */
export const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
export const NUS_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
export const NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'

const CHUNK = 160
const CHUNK_PAUSE_MS = 12

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

type GattServer = {
  connected: boolean
  connect: () => Promise<GattServer>
  getPrimaryService: (uuid: string) => Promise<GattService>
  disconnect: () => void
}

type GattService = {
  getCharacteristic: (uuid: string) => Promise<GattCharacteristic>
}

type GattCharacteristic = {
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>
  writeValue: (value: BufferSource) => Promise<void>
  startNotifications: () => Promise<GattCharacteristic>
  addEventListener: (type: string, listener: (event: Event) => void) => void
  removeEventListener: (type: string, listener: (event: Event) => void) => void
}

type BleDevice = {
  name?: string
  gatt?: GattServer
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

export function bluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export type NusSession = {
  name: string
  send: (text: string) => Promise<void>
  disconnect: () => void
}

export async function connectNus(hooks: {
  onRx: (text: string) => void
  onDisconnect: () => void
}): Promise<NusSession> {
  const bluetooth = (navigator as Navigator & {
    bluetooth: {
      requestDevice: (options: unknown) => Promise<BleDevice>
    }
  }).bluetooth

  const device = await bluetooth.requestDevice({
    filters: [{namePrefix: 'BLE'}, {namePrefix: 'BLEberry'}],
    optionalServices: [NUS_SERVICE],
  })

  const server = await device.gatt?.connect()
  if (!server) throw new Error('Kein GATT-Server')

  const service = await server.getPrimaryService(NUS_SERVICE)
  const rx = await service.getCharacteristic(NUS_RX)
  const tx = await service.getCharacteristic(NUS_TX)

  const decoder = new TextDecoder()
  const onValue = (event: Event): void => {
    const target = event.target as {value?: DataView} | null
    const value = target?.value
    if (!value) return
    hooks.onRx(decoder.decode(value, {stream: true}))
  }
  await tx.startNotifications()
  tx.addEventListener('characteristicvaluechanged', onValue)

  const onGone = (): void => {
    cleanup()
    hooks.onDisconnect()
  }
  device.addEventListener('gattserverdisconnected', onGone)

  let closed = false
  const cleanup = (): void => {
    if (closed) return
    closed = true
    tx.removeEventListener('characteristicvaluechanged', onValue)
    device.removeEventListener('gattserverdisconnected', onGone)
    try {
      if (server.connected) server.disconnect()
    } catch {
      /* already gone */
    }
  }

  return {
    name: device.name?.trim() || 'BLE-Gerät',
    async send(text: string) {
      if (closed) throw new Error('Nicht verbunden')
      const bytes = new TextEncoder().encode(text)
      for (let offset = 0; offset < bytes.length; offset += CHUNK) {
        const slice = bytes.subarray(offset, offset + CHUNK)
        if (rx.writeValueWithoutResponse) {
          await rx.writeValueWithoutResponse(slice)
        } else {
          await rx.writeValue(slice)
        }
        if (offset + CHUNK < bytes.length) await pause(CHUNK_PAUSE_MS)
      }
    },
    disconnect: cleanup,
  }
}
