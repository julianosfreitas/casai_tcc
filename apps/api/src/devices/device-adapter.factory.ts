import { Injectable, NotImplementedException } from '@nestjs/common';
import type { Device } from '@prisma/client';
import { CryptoService } from '../common/crypto/crypto.service';
import { MockAdapter } from './adapters/mock.adapter';
import { TuyaAdapter } from './adapters/tuya.adapter';
import { TuyaCloudAdapter } from './adapters/tuya-cloud.adapter';
import { TapoAdapter } from './adapters/tapo.adapter';
import { HomeAssistantAdapter } from './adapters/home-assistant.adapter';
import type { AdapterContext, DeviceAdapter } from './device-adapter.interface';

/**
 * Escolhe e instancia o adapter certo pelo campo `protocol`. Descriptografa os
 * segredos (local_key / senha Tapo) APENAS aqui, em memória, no momento do uso.
 */
@Injectable()
export class DeviceAdapterFactory {
  constructor(private readonly crypto: CryptoService) {}

  create(device: Device): DeviceAdapter {
    const ctx: AdapterContext = {
      deviceId: device.id,
      name: device.name,
      ip: device.ip,
      externalId: device.externalId,
      protocolVersion: device.protocolVersion,
      localKey: device.localKeyEnc ? this.crypto.decrypt(device.localKeyEnc) : null,
      tapoEmail: device.tapoEmail,
      tapoPass: device.tapoPassEnc ? this.crypto.decrypt(device.tapoPassEnc) : null,
      supportsBrightness: device.supportsBrightness,
      supportsColor: device.supportsColor,
      supportsColorTemp: device.supportsColorTemp,
      supportsEnergy: device.supportsEnergy,
    };

    switch (device.protocol) {
      case 'TUYA':
        return new TuyaAdapter(ctx);
      case 'TUYA_CLOUD':
        // Credenciais do Cloud Project vêm do ambiente (TUYA_CLOUD_*); o device id é o externalId.
        return new TuyaCloudAdapter(ctx);
      case 'TAPO':
        return new TapoAdapter(ctx);
      case 'HOME_ASSISTANT':
        // Token + URL da instância HA vêm do ambiente (HOME_ASSISTANT_*); o entity_id é o externalId.
        return new HomeAssistantAdapter(ctx);
      case 'MOCK':
        return new MockAdapter(ctx);
      case 'ZIGBEE':
        throw new NotImplementedException('Zigbee é fase futura (TCC 2)');
      default:
        throw new Error(`Protocolo não suportado: ${String(device.protocol)}`);
    }
  }
}
