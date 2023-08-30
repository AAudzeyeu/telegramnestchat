import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import {TelegrafModule} from "nestjs-telegraf";
import {options} from "./telegram-confif.factory";
import {ChatgptModule} from "../chatgpt/chatgpt.module";

@Module({
  imports: [TelegrafModule.forRootAsync(options()), ChatgptModule],
  providers: [TelegramService]
})
export class TelegramModule {}
