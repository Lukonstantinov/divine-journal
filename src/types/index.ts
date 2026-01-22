// Note categories - each note has exactly ONE category
export type NoteCategory = 'note' | 'dream' | 'revelation' | 'reminder';

// Repeat frequency for reminders
export type RepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

// Main Note interface
export interface Note {
  id: string;
  title: string;
  content: string;
  plainText: string;
  createdAt: number;
  updatedAt: number;
  dateFor: number;
  isDeleted: boolean;
  syncStatus: 'pending' | 'synced' | 'conflict';
  // Category (single selection)
  category: NoteCategory;
  // Reminder fields (only used when category === 'reminder')
  reminderTime?: number;        // When the reminder should fire (timestamp)
  reminderOffset?: number;      // Minutes before to remind (0, 5, 15, 30, 60, 1440)
  notificationId?: string;      // Expo notification ID for cancellation
  // Repeat settings
  repeatFrequency?: RepeatFrequency;
  repeatDaysOfWeek?: number[];  // For weekly: [0,1,2,3,4,5,6] = Sun-Sat
  repeatDayOfMonth?: number;    // For monthly: 1-31
}

// Category definition with colors
export interface Category {
  id: NoteCategory;
  name: string;
  nameRu: string;  // Russian translation
  icon: string;
  color: string;           // Badge/accent color
  backgroundColor: string; // Light background for cards
}

// Tag interface (kept for backward compatibility, may be used for custom tags later)
export interface Tag {
  id: string;
  name: string;
  color: string;
  icon: string;
}

// Reminder settings stored in AsyncStorage
export interface ReminderSettings {
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  defaultOffset: number;
  defaultSnoozeMinutes: number;
}

// Snooze options
export interface SnoozeOption {
  label: string;
  labelRu: string;
  minutes: number;
}
