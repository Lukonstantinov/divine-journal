
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  getReminderSettings, 
  saveReminderSettings,
  getScheduledReminders,
  cancelAllReminders,
  isNotificationsAvailable,
} from '../lib/notifications';
import { ReminderSettings } from '../types';
import { DEFAULT_REMINDER_SETTINGS, REMINDER_OFFSETS, SNOOZE_OPTIONS } from '../constants/defaultTags';

interface SettingsScreenProps {
  navigation: any;
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [showOffsetModal, setShowOffsetModal] = useState(false);
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const notificationsAvailable = isNotificationsAvailable();

  useEffect(() => {
    loadSettings();
    loadScheduledCount();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadScheduledCount();
    });
    return unsubscribe;
  }, [navigation]);

  const loadSettings = async () => {
    const loaded = await getReminderSettings();
    setSettings(loaded);
  };

  const loadScheduledCount = async () => {
    const scheduled = await getScheduledReminders();
    setScheduledCount(scheduled.length);
  };

  const updateSetting = async (key: keyof ReminderSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveReminderSettings({ [key]: value });
  };

  const handleClearAllReminders = () => {
    if (scheduledCount === 0) {
      Alert.alert('Информация', 'Нет запланированных напоминаний');
      return;
    }

    Alert.alert(
      'Отменить все напоминания?',
      `Будет отменено ${scheduledCount} напоминаний. Это действие нельзя отменить.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Отменить все',
          style: 'destructive',
          onPress: async () => {
            await cancelAllReminders();
            setScheduledCount(0);
            Alert.alert('Готово', 'Все напоминания отменены');
          },
        },
      ]
    );
  };

  const getOffsetLabel = (value: number) => {
    const option = REMINDER_OFFSETS.find(o => o.value === value);
    return option?.labelRu || `${value} мин`;
  };

  const getSnoozeLabel = (value: number) => {
    const option = SNOOZE_OPTIONS.find(o => o.minutes === value);
    return option?.labelRu || `${value} мин`;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Expo Go Warning */}
        {!notificationsAvailable && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>⚠️ Expo Go</Text>
            <Text style={styles.warningText}>
              Уведомления недоступны в Expo Go. Соберите APK для работы напоминаний.
            </Text>
          </View>
        )}

        {/* Reminder Settings Section */}
        <Text style={styles.sectionTitle}>Настройки напоминаний</Text>
        
        <View style={styles.card}>
          {/* Vibration Toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Вибрация</Text>
              <Text style={styles.settingDescription}>
                Вибрировать при напоминании
              </Text>
            </View>
            <Switch
              value={settings.vibrationEnabled}
              onValueChange={(value) => updateSetting('vibrationEnabled', value)}
              trackColor={{ false: '#DDD', true: '#4A90D9' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          {/* Sound Toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Звук</Text>
              <Text style={styles.settingDescription}>
                Воспроизводить звук при напоминании
              </Text>
            </View>
            <Switch
              value={settings.soundEnabled}
              onValueChange={(value) => updateSetting('soundEnabled', value)}
              trackColor={{ false: '#DDD', true: '#4A90D9' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          {/* Default Offset */}
          <TouchableOpacity 
            style={styles.settingRow}
            onPress={() => setShowOffsetModal(true)}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Напоминать заранее</Text>
              <Text style={styles.settingDescription}>
                По умолчанию для новых напоминаний
              </Text>
            </View>
            <Text style={styles.settingValue}>
              {getOffsetLabel(settings.defaultOffset)} →
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Default Snooze */}
          <TouchableOpacity 
            style={styles.settingRow}
            onPress={() => setShowSnoozeModal(true)}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Отложить на</Text>
              <Text style={styles.settingDescription}>
                Время отсрочки по умолчанию
              </Text>
            </View>
            <Text style={styles.settingValue}>
              {getSnoozeLabel(settings.defaultSnoozeMinutes)} →
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Reminders */}
        <Text style={styles.sectionTitle}>Активные напоминания</Text>
        
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Запланировано</Text>
              <Text style={styles.settingDescription}>
                Количество активных напоминаний
              </Text>
            </View>
            <Text style={styles.countBadge}>{scheduledCount}</Text>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity 
            style={styles.settingRow}
            onPress={handleClearAllReminders}
          >
            <Text style={styles.dangerText}>Отменить все напоминания</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <Text style={styles.sectionTitle}>О приложении</Text>
        
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Версия</Text>
            <Text style={styles.settingValue}>2.0.0</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Дневник Христианина</Text>
          </View>
        </View>
      </ScrollView>

      {/* Offset Selection Modal */}
      <Modal
        visible={showOffsetModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOffsetModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOffsetModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Напоминать заранее</Text>
            {REMINDER_OFFSETS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  settings.defaultOffset === option.value && styles.modalOptionSelected
                ]}
                onPress={() => {
                  updateSetting('defaultOffset', option.value);
                  setShowOffsetModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  settings.defaultOffset === option.value && styles.modalOptionTextSelected
                ]}>
                  {option.labelRu}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Snooze Selection Modal */}
      <Modal
        visible={showSnoozeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSnoozeModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSnoozeModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Отложить на</Text>
            {SNOOZE_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.minutes}
                style={[
                  styles.modalOption,
                  settings.defaultSnoozeMinutes === option.minutes && styles.modalOptionSelected
                ]}
                onPress={() => {
                  updateSetting('defaultSnoozeMinutes', option.minutes);
                  setShowSnoozeModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  settings.defaultSnoozeMinutes === option.minutes && styles.modalOptionTextSelected
                ]}>
                  {option.labelRu}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#4A90D9',
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  warningCard: {
    backgroundColor: '#FFF3CD',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  settingDescription: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  settingValue: {
    fontSize: 15,
    color: '#4A90D9',
  },
  countBadge: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A90D9',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  dangerText: {
    fontSize: 16,
    color: '#E74C3C',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalOptionTextSelected: {
    color: '#4A90D9',
    fontWeight: '600',
  },
});

