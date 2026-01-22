import { Category, SnoozeOption, ReminderSettings } from '../types';

// Category definitions with colors for note cards
export const CATEGORIES: Record<string, Category> = {
  note: {
    id: 'note',
    name: 'Note',
    nameRu: 'Заметка',
    icon: '📝',
    color: '#4A90D9',
    backgroundColor: '#E3F2FD',
  },
  dream: {
    id: 'dream',
    name: 'Dream',
    nameRu: 'Сон',
    icon: '🌙',
    color: '#9B59B6',
    backgroundColor: '#F3E5F5',
  },
  revelation: {
    id: 'revelation',
    name: 'Revelation',
    nameRu: 'Откровение',
    icon: '✨',
    color: '#F39C12',
    backgroundColor: '#FFF8E1',
  },
  reminder: {
    id: 'reminder',
    name: 'Reminder',
    nameRu: 'Напоминание',
    icon: '⏰',
    color: '#E74C3C',
    backgroundColor: '#FFEBEE',
  },
};

// Get category by ID with fallback
export function getCategory(id: string): Category {
  return CATEGORIES[id] || CATEGORIES.note;
}

// Reminder offset options (minutes before event)
export const REMINDER_OFFSETS = [
  { label: 'At time of event', labelRu: 'В момент события', value: 0 },
  { label: '5 minutes before', labelRu: 'За 5 минут', value: 5 },
  { label: '15 minutes before', labelRu: 'За 15 минут', value: 15 },
  { label: '30 minutes before', labelRu: 'За 30 минут', value: 30 },
  { label: '1 hour before', labelRu: 'За 1 час', value: 60 },
  { label: '1 day before', labelRu: 'За 1 день', value: 1440 },
];

// Snooze options
export const SNOOZE_OPTIONS: SnoozeOption[] = [
  { label: '5 minutes', labelRu: '5 минут', minutes: 5 },
  { label: '15 minutes', labelRu: '15 минут', minutes: 15 },
  { label: '30 minutes', labelRu: '30 минут', minutes: 30 },
  { label: '1 hour', labelRu: '1 час', minutes: 60 },
];

// Repeat frequency options
export const REPEAT_OPTIONS = [
  { label: 'Does not repeat', labelRu: 'Не повторять', value: 'none' as const },
  { label: 'Daily', labelRu: 'Ежедневно', value: 'daily' as const },
  { label: 'Weekly', labelRu: 'Еженедельно', value: 'weekly' as const },
  { label: 'Monthly', labelRu: 'Ежемесячно', value: 'monthly' as const },
];

// Days of week for weekly repeat
export const DAYS_OF_WEEK = [
  { label: 'Sun', labelRu: 'Вс', value: 0 },
  { label: 'Mon', labelRu: 'Пн', value: 1 },
  { label: 'Tue', labelRu: 'Вт', value: 2 },
  { label: 'Wed', labelRu: 'Ср', value: 3 },
  { label: 'Thu', labelRu: 'Чт', value: 4 },
  { label: 'Fri', labelRu: 'Пт', value: 5 },
  { label: 'Sat', labelRu: 'Сб', value: 6 },
];

// Default reminder settings
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  vibrationEnabled: true,
  soundEnabled: false,
  defaultOffset: 15,
  defaultSnoozeMinutes: 15,
};

// Legacy DEFAULT_TAGS for backward compatibility
export const DEFAULT_TAGS = Object.values(CATEGORIES).map(cat => ({
  id: `tag-${cat.id}`,
  name: cat.name,
  color: cat.color,
  icon: cat.icon,
}));
