import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import {TelegrafModule} from "nestjs-telegraf";
import {options} from "./telegram-confif.factory";

@Module({
  imports: [TelegrafModule.forRootAsync(options())],
  providers: [TelegramService]
})
export class TelegramModule {}
