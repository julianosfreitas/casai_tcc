import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DeviceCommandDto } from './dto/device-command.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.devices.list(user.id);
  }

  @Post('discover')
  @HttpCode(HttpStatus.OK)
  discover(@CurrentUser() user: AuthUser) {
    return this.devices.discover(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devices.get(user.id, id);
  }

  // Leitura de estado SEM mutar (usada pelo "Testar conexão") — não liga/desliga.
  @Get(':id/state')
  state(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devices.getState(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDeviceDto) {
    return this.devices.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateDeviceDto) {
    return this.devices.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devices.remove(user.id, id);
  }

  @Post(':id/command')
  @HttpCode(HttpStatus.OK)
  command(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DeviceCommandDto) {
    return this.devices.executeCommand(user.id, id, dto);
  }
}
