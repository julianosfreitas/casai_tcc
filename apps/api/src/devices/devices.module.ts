import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { DeviceAdapterFactory } from './device-adapter.factory';
import { DeviceCommandQueue } from './device-command.queue';
import { DeviceEvents, NoopDeviceEvents } from './device-events';

@Module({
  controllers: [DevicesController],
  providers: [
    DevicesService,
    DeviceAdapterFactory,
    DeviceCommandQueue,
    // No-op por enquanto; o gateway WebSocket substitui no Passo 5.
    { provide: DeviceEvents, useClass: NoopDeviceEvents },
  ],
  exports: [DevicesService, DeviceAdapterFactory, DeviceCommandQueue],
})
export class DevicesModule {}
