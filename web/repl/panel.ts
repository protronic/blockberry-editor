import {
  NusBluetoothTransport,
  ReplWebSocketTransport,
  type ReplTransport,
  type ReplTransportKind,
} from './client.ts';

function required<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`REPL-Element #${id} fehlt`);
  return value as T;
}

export function mountReplPanel(): void {
  const dialog = required<HTMLDialogElement>('repl-dialog');
  const openButton = required<HTMLButtonElement>('open-repl');
  const closeButton = required<HTMLButtonElement>('close-repl');
  const connectButton = required<HTMLButtonElement>('repl-connect');
  const sendForm = required<HTMLFormElement>('repl-form');
  const input = required<HTMLInputElement>('repl-command');
  const output = required<HTMLElement>('repl-output');
  const status = required<HTMLElement>('repl-status');
  const wsUrl = required<HTMLInputElement>('repl-ws-url');
  const wsSettings = required<HTMLElement>('repl-ws-settings');
  const transportButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-repl-transport]'),
  );

  let kind: ReplTransportKind = 'bluetooth';
  let transport: ReplTransport | undefined;
  let connected = false;
  const history: string[] = [];
  let historyIndex = 0;

  function append(text: string, className = ''): void {
    const line = document.createElement('span');
    if (className) line.className = className;
    line.textContent = text;
    output.append(line);
    while ((output.textContent?.length ?? 0) > 50_000 && output.firstChild) {
      output.firstChild.remove();
    }
    output.scrollTop = output.scrollHeight;
  }

  function setConnected(next: boolean, message: string): void {
    connected = next;
    status.textContent = message;
    status.classList.toggle('connected', next);
    connectButton.textContent = next ? 'Trennen' : 'Verbinden';
    input.disabled = !next;
    if (next) input.focus();
  }

  function selectTransport(next: ReplTransportKind): void {
    if (connected) return;
    kind = next;
    for (const button of transportButtons) {
      button.classList.toggle('active', button.dataset.replTransport === kind);
    }
    wsSettings.classList.toggle('hidden', kind !== 'websocket');
    status.textContent = kind === 'bluetooth' ? 'NUS nicht verbunden' : 'Bridge nicht verbunden';
  }

  for (const button of transportButtons) {
    button.addEventListener('click', () => {
      selectTransport(button.dataset.replTransport as ReplTransportKind);
    });
  }

  openButton.addEventListener('click', () => {
    dialog.showModal();
    window.setTimeout(() => connectButton.focus(), 0);
  });

  closeButton.addEventListener('click', () => dialog.close());

  connectButton.addEventListener('click', async () => {
    if (connected) {
      transport?.disconnect();
      transport = undefined;
      setConnected(false, 'Getrennt');
      return;
    }

    connectButton.disabled = true;
    status.textContent = 'Verbindung wird aufgebaut …';
    try {
      transport =
        kind === 'bluetooth'
          ? new NusBluetoothTransport()
          : new ReplWebSocketTransport(wsUrl.value.trim());
      await transport.connect((text) => append(text));
      setConnected(true, kind === 'bluetooth' ? 'BLE NUS verbunden' : 'Host verbunden');
      append(`\n[web] ${status.textContent}\n`, 'system');
    } catch (error) {
      transport?.disconnect();
      transport = undefined;
      setConnected(false, error instanceof Error ? error.message : 'Verbindung fehlgeschlagen');
    } finally {
      connectButton.disabled = false;
    }
  });

  sendForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const command = input.value.trim();
    if (!command || !transport) return;
    append(`${command}\n`, 'command');
    history.push(command);
    historyIndex = history.length;
    input.value = '';
    try {
      await transport.send(command);
    } catch (error) {
      append(`[web] ${error instanceof Error ? error.message : 'Senden fehlgeschlagen'}\n`, 'error');
    }
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp' && history.length) {
      event.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] ?? '';
    } else if (event.key === 'ArrowDown' && history.length) {
      event.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] ?? '';
    }
  });

  dialog.addEventListener('close', () => {
    if (connected) {
      transport?.disconnect();
      transport = undefined;
      setConnected(false, 'Getrennt');
    }
  });

  selectTransport('bluetooth');
}
