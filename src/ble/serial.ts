/** Web Serial over USB-CDC — same byte stream as a local COM port. */

const CHUNK = 256
const CHUNK_PAUSE_MS = 4
const BAUD = 115200

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

type SerialPortInfo = {
  usbVendorId?: number
  usbProductId?: number
}

type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  open: (options: {baudRate: number; bufferSize?: number}) => Promise<void>
  close: () => Promise<void>
  getInfo: () => SerialPortInfo
  setSignals?: (signals: {
    dataTerminalReady?: boolean
    requestToSend?: boolean
  }) => Promise<void>
  addEventListener: (type: string, listener: () => void) => void
  removeEventListener: (type: string, listener: () => void) => void
}

export type SerialSession = {
  name: string
  send: (text: string) => Promise<void>
  disconnect: () => void
}

export function serialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

function portLabel(port: SerialPortLike): string {
  const info = port.getInfo()
  const vid = info.usbVendorId
  const pid = info.usbProductId
  if (vid == null) return 'USB-CDC'
  const toHex = (value: number) => value.toString(16).padStart(4, '0')
  return pid == null ? `USB ${toHex(vid)}` : `USB ${toHex(vid)}:${toHex(pid)}`
}

export async function connectSerial(hooks: {
  onRx: (text: string) => void
  onDisconnect: () => void
}): Promise<SerialSession> {
  const serial = (
    navigator as Navigator & {
      serial: {requestPort: () => Promise<SerialPortLike>}
    }
  ).serial

  const port = await serial.requestPort()
  await port.open({baudRate: BAUD, bufferSize: 8192})
  try {
    await port.setSignals?.({dataTerminalReady: true, requestToSend: true})
  } catch {
    /* some CDC stacks reject line signals */
  }

  const readable = port.readable
  const writable = port.writable
  if (!readable || !writable) {
    await port.close().catch((): void => undefined)
    throw new Error('USB-Port ohne Datenkanal')
  }

  const reader = readable.getReader()
  const writer = writable.getWriter()
  const decoder = new TextDecoder()

  let closed = false
  const cleanup = (): void => {
    if (closed) return
    closed = true
    port.removeEventListener('disconnect', onGone)
    void (async () => {
      try {
        await reader.cancel()
      } catch {
        /* already cancelled */
      }
      try {
        reader.releaseLock()
      } catch {
        /* already released */
      }
      try {
        writer.releaseLock()
      } catch {
        /* already released */
      }
      try {
        await port.close()
      } catch {
        /* already gone */
      }
    })()
  }

  const onGone = (): void => {
    cleanup()
    hooks.onDisconnect()
  }
  port.addEventListener('disconnect', onGone)

  void (async () => {
    try {
      while (!closed) {
        const {value, done} = await reader.read()
        if (done) break
        if (value?.byteLength) hooks.onRx(decoder.decode(value, {stream: true}))
      }
    } catch {
      /* unplug / cancel */
    }
    if (!closed) onGone()
  })()

  return {
    name: portLabel(port),
    async send(text: string) {
      if (closed) throw new Error('Nicht verbunden')
      const bytes = new TextEncoder().encode(text)
      for (let offset = 0; offset < bytes.length; offset += CHUNK) {
        await writer.write(bytes.subarray(offset, offset + CHUNK))
        if (offset + CHUNK < bytes.length) await pause(CHUNK_PAUSE_MS)
      }
    },
    disconnect: cleanup,
  }
}
