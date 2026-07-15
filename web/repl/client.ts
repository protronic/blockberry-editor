export type ReplTransportKind = 'bluetooth' | 'websocket';
export type ReplStatus = 'disconnected' | 'connecting' | 'connected';

export interface ReplTransport {
  connect(onData: (text: string) => void): Promise<void>;
  disconnect(): void;
  send(command: string): Promise<void>;
}

const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export class NusBluetoothTransport implements ReplTransport {
  private device?: BluetoothDevice;
  private rx?: BluetoothRemoteGATTCharacteristic;
  private tx?: BluetoothRemoteGATTCharacteristic;
  private readonly decoder = new TextDecoder();
  private onData: (text: string) => void = () => {};

  async connect(onData: (text: string) => void): Promise<void> {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth wird von diesem Browser nicht unterstützt');
    }
    this.onData = onData;
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{services: [NUS_SERVICE]}],
      optionalServices: [NUS_SERVICE],
    });
    const server = await this.device.gatt?.connect();
    if (!server) throw new Error('Keine GATT-Verbindung verfügbar');

    const service = await server.getPrimaryService(NUS_SERVICE);
    this.rx = await service.getCharacteristic(NUS_RX);
    this.tx = await service.getCharacteristic(NUS_TX);
    await this.tx.startNotifications();
    this.tx.addEventListener('characteristicvaluechanged', this.handleNotification);
  }

  disconnect(): void {
    this.tx?.removeEventListener('characteristicvaluechanged', this.handleNotification);
    this.device?.gatt?.disconnect();
    this.rx = undefined;
    this.tx = undefined;
    this.device = undefined;
  }

  async send(command: string): Promise<void> {
    if (!this.rx) throw new Error('NUS ist nicht verbunden');
    const bytes = new TextEncoder().encode(`${command.replace(/[\r\n]+$/, '')}\n`);

    for (let offset = 0; offset < bytes.length; offset += 20) {
      const chunk = bytes.slice(offset, offset + 20);
      if ('writeValueWithoutResponse' in this.rx) {
        await this.rx.writeValueWithoutResponse(chunk);
      } else {
        await this.rx.writeValue(chunk);
      }
    }
  }

  private handleNotification = (event: Event): void => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    if (!characteristic.value) return;
    this.onData(this.decoder.decode(characteristic.value, {stream: true}));
  };
}

export class ReplWebSocketTransport implements ReplTransport {
  private socket?: WebSocket;

  constructor(private readonly url: string) {}

  connect(onData: (text: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      socket.addEventListener('open', () => resolve(), {once: true});
      socket.addEventListener('error', () => reject(new Error('WebSocket-Verbindung fehlgeschlagen')), {
        once: true,
      });
      socket.addEventListener('message', (event) => onData(String(event.data)));
    });
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = undefined;
  }

  async send(command: string): Promise<void> {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket ist nicht verbunden');
    }
    this.socket.send(command);
  }
}
