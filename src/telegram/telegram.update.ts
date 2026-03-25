import { Start, Update, Ctx } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';

@Update()
export class TelegramUpdate {
  @Start()
  async onStart(@Ctx() ctx: Context) {
    await ctx.reply(
      'Hello! I am your economic calendar notification bot.\n\n' +
        'I help you track important events and send reminders before them.',
      Markup.keyboard([['📊 Today reports'], ['⚙️ Settings']])
        .resize()
        .persistent(),
    );
  }
}
