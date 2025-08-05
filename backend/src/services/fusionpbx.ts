import net from 'net';
import EventEmitter from 'events';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface FusionEvent {
  headers: Record<string, string>;
  body: string;
}

class FusionPBXService extends EventEmitter {
  private client: net.Socket | null = null;
  private reconnectTimer?: NodeJS.Timeout;

  private readonly host = process.env.FUSIONPBX_WS?.replace('ws://', '').replace('wss://', '').split(':')[0] || 'localhost';
  private readonly port = Number(process.env.FUSIONPBX_WS?.split(':')[2] || 8021);
  private readonly password = process.env.FUSIONPBX_API_PASS || 'ClueCon';

  connect() {
    if (this.client) return;

    this.client = net.createConnection({ host: this.host, port: this.port }, () => {
      this.client?.write(`auth ${this.password}\n\n`);
      this.emit('connected');
    });

    this.client.on('data', (data: Buffer) => {
      const str = data.toString();
      if (str.startsWith('+OK accepted')) {
        // authenticated
        this.emit('authenticated');
        // subscribe to call events minimal
        this.client?.write('event plain ALL\n\n');
        return;
      }
      // parse headers
      const [headerStr, body] = str.split('\n\n');
      const headers: Record<string, string> = {};
      headerStr.split('\n').forEach((line) => {
        const [k, v] = line.split(': ');
        if (k && v) headers[k.trim()] = v.trim();
      });
      this.emit('event', { headers, body } as FusionEvent);
    });

    this.client.on('error', (err) => {
      console.error('FusionPBX connection error', err.message);
      // Don't crash the server, just log the error and don't emit
      this.scheduleReconnect();
    });

    this.client.on('close', () => {
      this.emit('disconnected');
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 5000);
  }
}

export const fusionPBX = new FusionPBXService(); 