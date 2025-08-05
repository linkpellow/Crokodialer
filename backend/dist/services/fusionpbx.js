"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fusionPBX = void 0;
const net_1 = __importDefault(require("net"));
const events_1 = __importDefault(require("events"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
class FusionPBXService extends events_1.default {
    constructor() {
        super(...arguments);
        this.client = null;
        this.host = process.env.FUSIONPBX_WS?.replace('ws://', '').replace('wss://', '').split(':')[0] || 'localhost';
        this.port = Number(process.env.FUSIONPBX_WS?.split(':')[2] || 8021);
        this.password = process.env.FUSIONPBX_API_PASS || 'ClueCon';
    }
    connect() {
        if (this.client)
            return;
        this.client = net_1.default.createConnection({ host: this.host, port: this.port }, () => {
            this.client?.write(`auth ${this.password}\n\n`);
            this.emit('connected');
        });
        this.client.on('data', (data) => {
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
            const headers = {};
            headerStr.split('\n').forEach((line) => {
                const [k, v] = line.split(': ');
                if (k && v)
                    headers[k.trim()] = v.trim();
            });
            this.emit('event', { headers, body });
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
    scheduleReconnect() {
        if (this.client) {
            this.client.destroy();
            this.client = null;
        }
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    }
}
exports.fusionPBX = new FusionPBXService();
