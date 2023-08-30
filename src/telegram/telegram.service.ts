import {Ctx, Message, On, Start, Update} from "nestjs-telegraf";
import {Telegraf, Scenes} from "telegraf";

type Context = Scenes.SceneContext;

@Update()
export class TelegramService extends  Telegraf<Context> {
    @Start()
    onStart(@Ctx() ctx: Context) {
        ctx.replyWithHTML(`<b>Привет, ${ctx.from.username}</b>
        Это чат бот от Томаса!
        Вводи любую фразу и получи ответ!
        `);
    }

    @On('text')
    onMessage(@Message('text') message: string, @Ctx() ctx: Context) {
        ctx.replyWithHTML(`<i>${message}</i>`);
    }

}
