import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VoiceService } from './voice.service';
import { VoiceController } from './voice.controller';
import { VoiceCommandParser } from './voice-command.parser';
import { SpeechToText } from './speech-to-text';
import { WhisperSttService } from './whisper.stt';
import { VoiceboxService } from './voicebox.service';
import { VoiceboxSttService } from './voicebox.stt';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [DevicesModule],
  controllers: [VoiceController],
  providers: [
    VoiceService,
    VoiceCommandParser,
    VoiceboxService,
    WhisperSttService,
    VoiceboxSttService,
    // STT: Whisper no hub por padrão; Voicebox (app local) se VOICE_STT_ENGINE=voicebox.
    {
      provide: SpeechToText,
      inject: [ConfigService, WhisperSttService, VoiceboxSttService],
      useFactory: (
        config: ConfigService,
        whisper: WhisperSttService,
        voicebox: VoiceboxSttService,
      ) => (config.get<string>('VOICE_STT_ENGINE') === 'voicebox' ? voicebox : whisper),
    },
  ],
  exports: [VoiceCommandParser],
})
export class VoiceModule {}
