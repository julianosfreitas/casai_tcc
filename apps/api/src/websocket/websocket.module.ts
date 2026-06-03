import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CasaiGateway } from './casai.gateway';
import { DeviceEvents } from '../devices/device-events';

/**
 * Fornece o gateway Socket.IO como a implementação real de DeviceEvents e o
 * exporta — assim DevicesModule (e Energy/Automations) fazem broadcast real.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET') }),
    }),
  ],
  providers: [CasaiGateway, { provide: DeviceEvents, useExisting: CasaiGateway }],
  exports: [DeviceEvents],
})
export class WebsocketModule {}
