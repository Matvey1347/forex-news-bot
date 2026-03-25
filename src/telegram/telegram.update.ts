import { Ctx, Hears, Start, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { MENU, PendingInputType } from './telegram.constants';
import { NotificationService } from './services/notification.service';
import { UserService } from './services/user.service';

type TelegramContext = Context & { message?: { text?: string } };

@Update()
export class TelegramUpdate {
  private readonly pendingInput = new Map<string, PendingInputType>();

  constructor(
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: TelegramContext) {
    const from = ctx.from;
    if (!from) {
      return;
    }

    await this.userService.ensureUserAndPreferences(from);

    await ctx.reply(
      'Hello! I am your economic calendar notification bot.\n\n' +
        'I help you track important events and send reminders before them.',
      this.mainMenu(),
    );
  }

  @Hears(MENU.MAIN_REPORTS)
  async onTodayReports(@Ctx() ctx: TelegramContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      return;
    }

    const text = await this.notificationService.sendDailyReportNow(
      String(telegramId),
    );
    await ctx.reply(text, this.mainMenu());
  }

  @Hears(MENU.MAIN_SETTINGS)
  async onSettings(@Ctx() ctx: TelegramContext) {
    await ctx.reply('Settings menu:', this.settingsMenu());
  }

  @Hears(MENU.SETTINGS_BACK)
  async onBackToMain(@Ctx() ctx: TelegramContext) {
    await ctx.reply('Back to main menu.', this.mainMenu());
  }

  @Hears(MENU.SETTINGS_SHOW)
  async onShowSettings(@Ctx() ctx: TelegramContext) {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      return;
    }

    const text = await this.notificationService.getCurrentSettings(
      String(telegramId),
    );
    await ctx.reply(text, this.settingsMenu());
  }

  @Hears(MENU.SETTINGS_REPORT_TIME)
  async onReportTime(@Ctx() ctx: TelegramContext) {
    await this.setPending(ctx, 'report_time');
    await ctx.reply(
      'Send report time in HH:mm format (e.g. 08:00).',
      this.settingsMenu(),
    );
  }

  @Hears(MENU.SETTINGS_CURRENCIES)
  async onCurrencies(@Ctx() ctx: TelegramContext) {
    await this.setPending(ctx, 'currencies');
    await ctx.reply(
      'Send currencies as comma separated list (e.g. USD,EUR,GBP).',
      this.settingsMenu(),
    );
  }

  @Hears(MENU.SETTINGS_IMPACTS)
  async onImpacts(@Ctx() ctx: TelegramContext) {
    await this.setPending(ctx, 'impacts');
    await ctx.reply(
      'Send impact priorities as comma separated list (e.g. high,medium).',
      this.settingsMenu(),
    );
  }

  @Hears(MENU.SETTINGS_INCLUDE)
  async onIncludeKeywords(@Ctx() ctx: TelegramContext) {
    await this.setPending(ctx, 'include_keywords');
    await ctx.reply(
      'Send include keywords as comma separated list.',
      this.settingsMenu(),
    );
  }

  @Hears(MENU.SETTINGS_EXCLUDE)
  async onExcludeKeywords(@Ctx() ctx: TelegramContext) {
    await this.setPending(ctx, 'exclude_keywords');
    await ctx.reply(
      'Send exclude keywords as comma separated list.',
      this.settingsMenu(),
    );
  }

  @Hears(/^[\s\S]+$/)
  async onAnyText(@Ctx() ctx: TelegramContext) {
    const telegramId = ctx.from?.id;
    const text = ctx.message?.text;
    if (!telegramId || !text) {
      return;
    }

    const pending = this.pendingInput.get(String(telegramId));
    if (!pending) {
      return;
    }

    try {
      const normalized =
        await this.notificationService.validateAndNormalizeInput(pending, text);
      await this.notificationService.updatePreference(String(telegramId), {
        [normalized.field]: normalized.value,
      });
      this.pendingInput.delete(String(telegramId));
      await ctx.reply(normalized.successMessage, this.settingsMenu());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid input.';
      await ctx.reply(message, this.settingsMenu());
    }
  }

  private async setPending(ctx: TelegramContext, type: PendingInputType) {
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      return;
    }
    this.pendingInput.set(String(telegramId), type);
  }

  private mainMenu() {
    return Markup.keyboard([[MENU.MAIN_REPORTS, MENU.MAIN_SETTINGS]])
      .resize()
      .persistent();
  }

  private settingsMenu() {
    return Markup.keyboard([
      [MENU.SETTINGS_REPORT_TIME, MENU.SETTINGS_CURRENCIES],
      [MENU.SETTINGS_IMPACTS, MENU.SETTINGS_INCLUDE],
      [MENU.SETTINGS_EXCLUDE, MENU.SETTINGS_SHOW],
      [MENU.SETTINGS_BACK],
    ])
      .resize()
      .persistent();
  }
}
