import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { DeviceAdapterFactory } from './device-adapter.factory';
import { DeviceCommandQueue } from './device-command.queue';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  // WebsocketModule fornece DeviceEvents (o gateway real).
  imports: [WebsocketModule],
  controllers: [DevicesController],
  providers: [DevicesService, DeviceAdapterFactory, DeviceCommandQueue],
  exports: [DevicesService, DeviceAdapterFactory, DeviceCommandQueue],
})
export class DevicesModule {}
