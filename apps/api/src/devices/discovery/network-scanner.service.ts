import { Injectable, Logger } from '@nestjs/common';
import * as dgram from 'node:dgram';
import * as net from 'node:net';
import { exec } from 'node:child_process';
import { createHash, createDecipheriv } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/** Chave universal do broadcast Tuya (md5 da string fixa do protocolo). */
const TUYA_UDP_KEY = createHash('md5').update('yGAdlopoPVldABfn').digest();

/**
 * Prefixos OUI (3 primeiros bytes do MAC) de fabricantes de automação
 * residencial. Curado — cobre os módulos Wi-Fi mais comuns no Brasil
 * (Tuya/Intelbras Izy, TP-Link Tapo/Kasa, Sonoff). Identificação offline,
 * sem depender de API externa.
 */
const OUI_VENDORS: Record<string, { vendor: string; guess: 'TUYA' | 'TAPO' | null }> = {
  // TP-Link (Tapo/Kasa)
  e848b8: { vendor: 'TP-Link', guess: 'TAPO' },
  '242fd0': { vendor: 'TP-Link', guess: 'TAPO' },
  '003192': { vendor: 'TP-Link', guess: 'TAPO' },
  '1c61b4': { vendor: 'TP-Link', guess: 'TAPO' },
  '5091e3': { vendor: 'TP-Link', guess: 'TAPO' },
  '6c5ab0': { vendor: 'TP-Link', guess: 'TAPO' },
  '98254a': { vendor: 'TP-Link', guess: 'TAPO' },
  ac84c6: { vendor: 'TP-Link', guess: 'TAPO' },
  b0a7b9: { vendor: 'TP-Link', guess: 'TAPO' },
  // Módulos Tuya / Intelbras Izy (fabricantes de módulos Wi-Fi smart)
  c0d2f3: { vendor: 'Hui Zhou Gaoshengda (Tuya)', guess: 'TUYA' },
  d81f12: { vendor: 'Tuya Smart', guess: 'TUYA' },
  '105a17': { vendor: 'Tuya Smart', guess: 'TUYA' },
  '68572d': { vendor: 'Tuya Smart', guess: 'TUYA' },
  '7c8334': { vendor: 'Tuya Smart', guess: 'TUYA' },
  a020a6: { vendor: 'Espressif (Tuya)', guess: 'TUYA' },
  '2462ab': { vendor: 'Espressif (Tuya)', guess: 'TUYA' },
  '500291': { vendor: 'Espressif (Tuya)', guess: 'TUYA' },
  '84f3eb': { vendor: 'Espressif (Tuya)', guess: 'TUYA' },
  dc4f22: { vendor: 'Espressif (Tuya)', guess: 'TUYA' },
};

export interface DiscoveredDevice {
  ip: string;
  mac?: string;
  vendor?: string;
  /** Palpite de protocolo a partir da porta aberta / fabricante. */
  protocolGuess: 'TUYA' | 'TAPO' | null;
  /** Portas TCP abertas relevantes (80, 443, 6668, 9999). */
  openPorts: number[];
  /** Tuya: device id descoberto no broadcast (preenche o cadastro). */
  externalId?: string;
  /** Tuya: versão do protocolo (3.3/3.4/3.5). */
  protocolVersion?: string;
  /** Como foi achado: broadcast passivo e/ou varredura de porta. */
  via: string[];
}

interface TuyaBroadcast {
  ip: string;
  gwId: string;
  version?: string;
  productKey?: string;
}

@Injectable()
export class NetworkScannerService {
  private readonly logger = new Logger(NetworkScannerService.name);
  // 80/443 = Tapo KLAP (firmware moderno); 6668 = Tuya local; 9999 = Tapo/Kasa legado.
  private static readonly PROBE_PORTS = [80, 443, 6668, 9999];

  /**
   * Descoberta combinada: escuta broadcast Tuya (passivo) + varre a sub-rede
   * por portas TCP típicas + identifica fabricante por OUI do MAC (ARP).
   * Pensado para rodar com o hub direto no host (vê a LAN). Em container sem
   * host-network o broadcast/ARP podem ficar vazios — daí o `hint`.
   */
  async discover(durationMs = 6000): Promise<{ devices: DiscoveredDevice[]; hint: string }> {
    const subnet = this.localSubnet();
    // Broadcast + scan TCP em paralelo. O scanTcp "aquece" a tabela ARP (abre conexões
    // TCP nos hosts), então lemos o ARP DEPOIS — assim o enriquecimento por fabricante
    // (OUI) enxerga os IPs recém-sondados em vez de uma tabela fria.
    const [broadcasts, openByIp] = await Promise.all([
      this.listenTuyaBroadcast(durationMs),
      subnet ? this.scanTcp(subnet) : Promise.resolve(new Map<string, number[]>()),
    ]);
    const arp = await this.readArpVendors();

    const byIp = new Map<string, DiscoveredDevice>();
    const ensure = (ip: string): DiscoveredDevice => {
      let d = byIp.get(ip);
      if (!d) {
        d = { ip, protocolGuess: null, openPorts: [], via: [] };
        byIp.set(ip, d);
      }
      return d;
    };

    // Broadcast Tuya (sinal mais forte: já traz device id e versão)
    for (const b of broadcasts) {
      const d = ensure(b.ip);
      d.protocolGuess = 'TUYA';
      d.externalId = b.gwId;
      d.protocolVersion = b.version;
      if (!d.via.includes('broadcast-tuya')) d.via.push('broadcast-tuya');
    }

    // Portas abertas na varredura (sinal FRACO de protocolo — só quando nada melhor)
    for (const [ip, ports] of openByIp) {
      const d = ensure(ip);
      d.openPorts = ports;
      if (!d.via.includes('tcp-scan')) d.via.push('tcp-scan');
      if (ports.includes(6668) && !d.protocolGuess) d.protocolGuess = 'TUYA';
      if (ports.includes(9999) && !d.protocolGuess) d.protocolGuess = 'TAPO';
    }

    // Fabricante por OUI (ARP). Precedência: broadcast Tuya > OUI > porta.
    // O OUI sobrescreve o palpite por porta (ex.: .6 tem porta 9999 mas MAC Tuya).
    for (const [ip, info] of arp) {
      const d = byIp.get(ip);
      if (!d) continue;
      d.mac = info.mac;
      d.vendor = info.vendor;
      const lockedByBroadcast = d.via.includes('broadcast-tuya');
      if (info.guess && !lockedByBroadcast) d.protocolGuess = info.guess;
    }

    // Só dispositivos de automação prováveis (descarta gateway/PC/celular).
    const devices = [...byIp.values()].filter(
      (d) =>
        d.protocolGuess !== null ||
        d.via.includes('broadcast-tuya') ||
        d.openPorts.some((p) => p === 6668 || p === 9999),
    );
    devices.sort((a, b) => a.ip.localeCompare(b.ip, undefined, { numeric: true }));

    const hint = devices.length
      ? 'Tuya: ainda é preciso a local_key para controlar (ver HARDWARE_SETUP.md). Tapo: informe e-mail/senha da conta TP-Link.'
      : 'Nenhum dispositivo de automação detectado. Verifique se estão ligados e na MESMA rede Wi-Fi 2.4GHz. Tomadas Tapo com firmware novo (KLAP) podem não aparecer na busca — cadastre manualmente pelo IP (app Tapo → dispositivo → Informações).';
    return { devices, hint };
  }

  /** Escuta o broadcast que dispositivos Tuya emitem em UDP 6666/6667. */
  private listenTuyaBroadcast(durationMs: number): Promise<TuyaBroadcast[]> {
    const found = new Map<string, TuyaBroadcast>();
    const sockets = [6666, 6667].map((port) => this.bindTuyaSocket(port, found));
    return new Promise((resolve) => {
      setTimeout(() => {
        for (const s of sockets) {
          try {
            s.close();
          } catch {
            /* já fechado */
          }
        }
        resolve([...found.values()]);
      }, durationMs);
    });
  }

  private bindTuyaSocket(port: number, found: Map<string, TuyaBroadcast>): dgram.Socket {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    sock.on('message', (msg) => {
      const data = this.parseTuyaPayload(msg);
      if (data?.gwId) found.set(data.gwId, data);
    });
    sock.on('error', (e) => this.logger.debug(`UDP ${port}: ${e.message}`));
    try {
      sock.bind(port);
    } catch (e) {
      this.logger.debug(`bind ${port}: ${String(e)}`);
    }
    return sock;
  }

  private parseTuyaPayload(msg: Buffer): TuyaBroadcast | null {
    try {
      const payload = msg.subarray(20, msg.length - 8);
      let text: string;
      try {
        const decipher = createDecipheriv('aes-128-ecb', TUYA_UDP_KEY, null);
        text = Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
      } catch {
        text = payload.toString('utf8'); // protocolo 3.1: texto puro
      }
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start < 0 || end <= start) return null;
      const json = JSON.parse(text.slice(start, end + 1)) as {
        ip?: string;
        gwId?: string;
        version?: string;
        productKey?: string;
      };
      if (!json.gwId || !json.ip) return null;
      return { ip: json.ip, gwId: json.gwId, version: json.version, productKey: json.productKey };
    } catch {
      return null;
    }
  }

  /** Varre a sub-rede /24 nas portas típicas de IoT (paralelizado em blocos). */
  private async scanTcp(subnet: string): Promise<Map<string, number[]>> {
    const open = new Map<string, number[]>();
    const hosts = Array.from({ length: 254 }, (_, i) => `${subnet}.${i + 1}`);
    const CHUNK = 48;
    for (let i = 0; i < hosts.length; i += CHUNK) {
      const chunk = hosts.slice(i, i + CHUNK);
      await Promise.all(
        chunk.map(async (ip) => {
          const ports: number[] = [];
          for (const p of NetworkScannerService.PROBE_PORTS) {
            if (await this.probe(ip, p)) ports.push(p);
          }
          if (ports.length) open.set(ip, ports);
        }),
      );
    }
    return open;
  }

  private probe(ip: string, port: number, timeout = 600): Promise<boolean> {
    return new Promise((resolve) => {
      const s = new net.Socket();
      let done = false;
      const finish = (ok: boolean): void => {
        if (done) return;
        done = true;
        s.destroy();
        resolve(ok);
      };
      s.setTimeout(timeout);
      s.once('connect', () => finish(true));
      s.once('timeout', () => finish(false));
      s.once('error', () => finish(false));
      s.connect(port, ip);
    });
  }

  /** Lê a tabela ARP do host e mapeia IP→{mac,vendor,guess} por OUI. */
  private async readArpVendors(): Promise<
    Map<string, { mac: string; vendor: string; guess: 'TUYA' | 'TAPO' | null }>
  > {
    const out = new Map<string, { mac: string; vendor: string; guess: 'TUYA' | 'TAPO' | null }>();
    try {
      const { stdout } = await execAsync('arp -a');
      // Formato `host (IP) at MAC ...` em macOS e Linux. O macOS imprime octetos SEM
      // zero à esquerda (ex.: 58:2:5b:aa:b:cc) — aceitamos 1-2 hex por octeto e
      // normalizamos com padStart, senão o OUI sai deslocado/errado.
      const re = /(\d+\.\d+\.\d+\.\d+)\)?\s+at\s+([0-9a-fA-F]{1,2}(?:[:-][0-9a-fA-F]{1,2}){5})\b/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(stdout)) !== null) {
        const ip = m[1];
        const mac = m[2]
          .split(/[:-]/)
          .map((o) => o.padStart(2, '0'))
          .join(':')
          .toLowerCase();
        const oui = mac.replace(/:/g, '').slice(0, 6);
        const vendor = OUI_VENDORS[oui];
        out.set(ip, {
          mac,
          vendor: vendor?.vendor ?? 'Desconhecido',
          guess: vendor?.guess ?? null,
        });
      }
      if (out.size === 0) {
        this.logger.warn(
          'ARP não retornou dispositivos legíveis; enriquecimento por fabricante (OUI) indisponível nesta plataforma.',
        );
      }
    } catch (e) {
      this.logger.debug(`arp: ${String(e)}`);
    }
    return out;
  }

  /** Sub-rede /24 da interface IPv4 ativa (ex.: "192.168.15"). */
  private localSubnet(): string | null {
    for (const addrs of Object.values(networkInterfaces())) {
      for (const a of addrs ?? []) {
        if (a.family === 'IPv4' && !a.internal) {
          const parts = a.address.split('.');
          if (parts[0] === '192' || parts[0] === '10' || parts[0] === '172') {
            return parts.slice(0, 3).join('.');
          }
        }
      }
    }
    return null;
  }
}
