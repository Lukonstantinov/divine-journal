import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReminderSettings, RepeatFrequency } from '../types';
import { DEFAULT_REMINDER_SETTINGS } from '../constants/defaultTags';

// Storage key for reminder settings
const SETTINGS_KEY = '@reminder_settings';

// In Expo Go, notifications don't work - this is a stub implementation
// Real notifications will work after building APK

// Check if notifications are available (always false in Expo Go)
export function isNotificationsAvailable(): boolean {
  return false; // Will be true in production APK
}

// Get reminder settings from storage
export async function getReminderSettings(): Promise<ReminderSettings> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_REMINDER_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error reading reminder settings:', error);
  }
  return DEFAULT_REMINDER_SETTINGS;
}

// Save reminder settings to storage
export async function saveReminderSettings(settings: Partial<ReminderSettings>): Promise<void> {
  try {
    const current = await getReminderSettings();
    const updated = { ...current, ...settings };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving reminder settings:', error);
  }
}

// Stub functions - these will work after APK build
export async function requestPermissions(): Promise<boolean> {
  console.log('Notifications not available in Expo Go');
  return false;
}

export async function hasPermissions(): Promise<boolean> {
  return false;
}

export async function scheduleReminder(
  noteId: string,
  title: string,
  body: string,
  triggerTime: Date,
  vibrate: boolean = true
): Promise<string | null> {
  console.log('Reminder scheduled (will work after APK build):', { noteId, title, triggerTime });
  return `stub-${Date.now()}`; // Return fake ID
}

export async function scheduleRepeatingReminder(
  noteId: string,
  title: string,
  body: string,
  baseTime: Date,
  frequency: RepeatFrequency,
  daysOfWeek?: number[],
  dayOfMonth?: number
): Promise<string | null> {
  console.log('Repeating reminder scheduled (will work after APK build):', { noteId, title, frequency });
  return `stub-${Date.now()}`; // Return fake ID
}

export async function snoozeReminder(
  noteId: string,
  title: string,
  body: string,
  snoozeMinutes: number
): Promise<string | null> {
  return `stub-${Date.now()}`;
}

export async function cancelReminder(notificationId: string | null | undefined): Promise<void> {
  // Stub - does nothing in Expo Go
}

export async function cancelAllReminders(): Promise<void> {
  // Stub - does nothing in Expo Go
}

export async function getScheduledReminders(): Promise<any[]> {
  return []; // No scheduled reminders in Expo Go
}

export function addNotificationReceivedListener(callback: any): null {
  return null;
}

export function addNotificationResponseListener(callback: any): null {
  return null;
}

export function removeNotificationListener(subscription: any): void {
  // Stub
}


