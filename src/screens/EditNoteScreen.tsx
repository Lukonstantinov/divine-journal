
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import * as Crypto from 'expo-crypto';
import { useNoteStore } from '../stores/noteStore';
import { CategoryPicker } from '../components/CategoryPicker';
import { ReminderPicker } from '../components/ReminderPicker';
import { Note, NoteCategory, RepeatFrequency } from '../types';
import { getNoteById } from '../lib/database';
import { getCategory } from '../constants/defaultTags';
import { 
  scheduleReminder, 
  scheduleRepeatingReminder,
  cancelReminder, 
  requestPermissions,
  hasPermissions,
  isNotificationsAvailable,
} from '../lib/notifications';

interface EditNoteScreenProps {
  navigation: any;
  route: any;
}

export function EditNoteScreen({ navigation, route }: EditNoteScreenProps) {
  const insets = useSafeAreaInsets();
  const { noteId } = route.params || {};
  const { addNote, updateNote, removeNote } = useNoteStore();

  // Note fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dateFor, setDateFor] = useState(Date.now());
  const [category, setCategory] = useState<NoteCategory>('note');
  
  // Reminder fields
  const [reminderTime, setReminderTime] = useState<number | null>(null);
  const [reminderOffset, setReminderOffset] = useState(15);
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency>('none');
  const [repeatDaysOfWeek, setRepeatDaysOfWeek] = useState<number[]>([]);
  const [repeatDayOfMonth, setRepeatDayOfMonth] = useState<number | null>(null);
  
  // State
  const [isEditing, setIsEditing] = useState(false);
  const [originalNote, setOriginalNote] = useState<Note | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (noteId) {
      loadNote();
    } else {
      // New note - set default reminder time to 1 hour from now
      setReminderTime(Date.now() + 60 * 60 * 1000);
    }
  }, [noteId]);

  const loadNote = async () => {
    const note = await getNoteById(noteId);
    if (note) {
      setOriginalNote(note);
      setTitle(note.title);
      setContent(note.plainText);
      setDateFor(note.dateFor);
      setCategory(note.category || 'note');
      setIsEditing(true);
      
      // Load reminder settings
      if (note.reminderTime) {
        setReminderTime(note.reminderTime);
      }
      if (note.reminderOffset !== undefined) {
        setReminderOffset(note.reminderOffset);
      }
      if (note.repeatFrequency) {
        setRepeatFrequency(note.repeatFrequency);
      }
      if (note.repeatDaysOfWeek) {
        setRepeatDaysOfWeek(note.repeatDaysOfWeek);
      }
      if (note.repeatDayOfMonth) {
        setRepeatDayOfMonth(note.repeatDayOfMonth);
      }
    }
  };

  const handleCategoryChange = async (newCategory: NoteCategory) => {
    setCategory(newCategory);
    
    // If switching to reminder, check permissions
    if (newCategory === 'reminder' && isNotificationsAvailable()) {
      const hasPerms = await hasPermissions();
      if (!hasPerms) {
        const granted = await requestPermissions();
        if (!granted) {
          Alert.alert(
            'Уведомления',
            'Напоминания будут работать после сборки APK. В Expo Go уведомления недоступны.',
            [{ text: 'OK' }]
          );
        }
      }
    }
  };

  const handleSave = async () => {
    if (isSaving) return; // Prevent double-tap
    
    if (!content.trim()) {
      Alert.alert('Ошибка', 'Напишите что-нибудь в заметке');
      return;
    }
    
    // Validate reminder time (only if notifications are available)
    if (category === 'reminder' && reminderTime) {
      const triggerTime = reminderTime - (reminderOffset * 60 * 1000);
      if (triggerTime < Date.now() && repeatFrequency === 'none') {
        Alert.alert('Внимание', 'Время напоминания уже прошло. Запись будет сохранена без уведомления.');
      }
    }

    setIsSaving(true);
    
    try {
      const now = Date.now();
      let notificationId: string | null | undefined = undefined;

      // Handle reminder scheduling (will return null in Expo Go)
      if (category === 'reminder' && reminderTime) {
        // Cancel old notification if editing
        if (originalNote?.notificationId) {
          await cancelReminder(originalNote.notificationId);
        }
        
        // Calculate trigger time
        const triggerTime = new Date(reminderTime - (reminderOffset * 60 * 1000));
        
        // Only schedule if time is in future
        if (triggerTime.getTime() > Date.now()) {
          // Schedule notification (returns null in Expo Go)
          if (repeatFrequency !== 'none') {
            notificationId = await scheduleRepeatingReminder(
              noteId || Crypto.randomUUID(),
              title || 'Напоминание',
              content,
              triggerTime,
              repeatFrequency,
              repeatDaysOfWeek.length > 0 ? repeatDaysOfWeek : undefined,
              repeatDayOfMonth || undefined
            );
          } else {
            notificationId = await scheduleReminder(
              noteId || Crypto.randomUUID(),
              title || 'Напоминание',
              content,
              triggerTime
            );
          }
        }
      } else if (originalNote?.notificationId) {
        // Category changed away from reminder, cancel old notification
        await cancelReminder(originalNote.notificationId);
      }

      if (isEditing && originalNote) {
        const updatedNote: Note = {
          ...originalNote,
          title: title.trim(),
          content: content.trim(),
          plainText: content.trim(),
          updatedAt: now,
          dateFor: dateFor,
          syncStatus: 'pending',
          category,
          reminderTime: category === 'reminder' ? reminderTime || undefined : undefined,
          reminderOffset: category === 'reminder' ? reminderOffset : undefined,
          notificationId: notificationId || undefined,
          repeatFrequency: category === 'reminder' ? repeatFrequency : undefined,
          repeatDaysOfWeek: category === 'reminder' && repeatDaysOfWeek.length > 0 ? repeatDaysOfWeek : undefined,
          repeatDayOfMonth: category === 'reminder' ? repeatDayOfMonth || undefined : undefined,
        };
        await updateNote(updatedNote);
      } else {
        const newNote: Note = {
          id: Crypto.randomUUID(),
          title: title.trim(),
          content: content.trim(),
          plainText: content.trim(),
          createdAt: now,
          updatedAt: now,
          dateFor: dateFor,
          isDeleted: false,
          syncStatus: 'pending',
          category,
          reminderTime: category === 'reminder' ? reminderTime || undefined : undefined,
          reminderOffset: category === 'reminder' ? reminderOffset : undefined,
          notificationId: notificationId || undefined,
          repeatFrequency: category === 'reminder' ? repeatFrequency : undefined,
          repeatDaysOfWeek: category === 'reminder' && repeatDaysOfWeek.length > 0 ? repeatDaysOfWeek : undefined,
          repeatDayOfMonth: category === 'reminder' ? repeatDayOfMonth || undefined : undefined,
        };
        await addNote(newNote);
      }

      navigation.goBack();
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить запись');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Удалить запись',
      'Вы уверены, что хотите удалить эту запись?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            if (originalNote?.notificationId) {
              await cancelReminder(originalNote.notificationId);
            }
            await removeNote(noteId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const categoryInfo = getCategory(category);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: categoryInfo.color, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Редактировать' : 'Новая запись'}
        </Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={isSaving}>
          <Text style={[styles.saveText, isSaving && { opacity: 0.5 }]}>
            {isSaving ? '...' : 'Сохранить'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {/* Date */}
          <Text style={styles.dateText}>
            {format(new Date(dateFor), 'd MMMM yyyy', { locale: ru })}
          </Text>

          {/* Category Picker */}
          <CategoryPicker
            selectedCategory={category}
            onSelectCategory={handleCategoryChange}
          />

          {/* Reminder Settings (shown when category is 'reminder') */}
          {category === 'reminder' && (
            <ReminderPicker
              reminderTime={reminderTime}
              reminderOffset={reminderOffset}
              repeatFrequency={repeatFrequency}
              repeatDaysOfWeek={repeatDaysOfWeek}
              repeatDayOfMonth={repeatDayOfMonth}
              onTimeChange={setReminderTime}
              onOffsetChange={setReminderOffset}
              onRepeatChange={setRepeatFrequency}
              onDaysOfWeekChange={setRepeatDaysOfWeek}
              onDayOfMonthChange={setRepeatDayOfMonth}
            />
          )}

          {/* Title Input */}
          <TextInput
            style={styles.titleInput}
            placeholder="Заголовок (необязательно)"
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          {/* Content Input */}
          <TextInput
            style={styles.contentInput}
            placeholder="Напишите здесь..."
            placeholderTextColor="#999"
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />

          {/* Delete Button (only for existing notes) */}
          {isEditing && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteText}>🗑 Удалить запись</Text>
            </TouchableOpacity>
          )}
          
          {/* Extra padding at bottom for keyboard */}
          <View style={{ height: 150 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    padding: 8,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  titleInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  contentInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#333',
    minHeight: 200,
    lineHeight: 24,
  },
  deleteButton: {
    marginTop: 30,
    padding: 16,
    alignItems: 'center',
  },
  deleteText: {
    color: '#E74C3C',
    fontSize: 16,
  },
});

