import {Ctx, Message, On, Start, Update} from "nestjs-telegraf";
import {Telegraf, Scenes} from "telegraf";
import {ConfigService} from "@nestjs/config";
import {ChatgptService} from "../chatgpt/chatgpt.service";

type Context = Scenes.SceneContext;

@Update()
export class TelegramService extends  Telegraf<Context> {
    constructor(private readonly configService: ConfigService, private readonly gpt: ChatgptService) {
        super(configService.get('TELEGRAM_API'));
            }
    @Start()
    onStart(@Ctx() ctx: Context) {
        ctx.replyWithHTML(`<b>Привет, ${ctx.from.username}</b>
        Это чат бот от Томаса!
        Вводи любую фразу и получи ответ!
        `);
    }

    @On('text')
    onMessage(@Message('text') message: string) {
        return this.gpt.generateResponce(message);
    }

}
