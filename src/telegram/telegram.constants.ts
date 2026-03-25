export const TELEGRAM_SOURCES = {
  FAIR_ECONOMY_WEEKLY: 'FAIR_ECONOMY_WEEKLY',
} as const;

export const MENU = {
  MAIN_REPORTS: '📊 Today\'s reports',
  MAIN_SETTINGS: '⚙️ Settings',
  SETTINGS_REPORT_TIME: 'Change report time',
  SETTINGS_CURRENCIES: 'Choose currencies',
  SETTINGS_IMPACTS: 'Choose impact priority',
  SETTINGS_INCLUDE: 'Set include keywords',
  SETTINGS_EXCLUDE: 'Set exclude keywords',
  SETTINGS_SHOW: 'Show current settings',
  SETTINGS_BACK: 'Back to main menu',
} as const;

export type PendingInputType =
  | 'report_time'
  | 'currencies'
  | 'impacts'
  | 'include_keywords'
  | 'exclude_keywords';
