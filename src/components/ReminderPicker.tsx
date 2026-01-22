import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { RepeatFrequency } from '../types';
import { REMINDER_OFFSETS, REPEAT_OPTIONS, DAYS_OF_WEEK } from '../constants/defaultTags';

interface ReminderPickerProps {
  reminderTime: number | null;
  reminderOffset: number;
  repeatFrequency: RepeatFrequency;
  repeatDaysOfWeek: number[];
  repeatDayOfMonth: number | null;
  onTimeChange: (time: number) => void;
  onOffsetChange: (offset: number) => void;
  onRepeatChange: (frequency: RepeatFrequency) => void;
  onDaysOfWeekChange: (days: number[]) => void;
  onDayOfMonthChange: (day: number) => void;
}

export function ReminderPicker({
  reminderTime,
  reminderOffset,
  repeatFrequency,
  repeatDaysOfWeek,
  repeatDayOfMonth,
  onTimeChange,
  onOffsetChange,
  onRepeatChange,
  onDaysOfWeekChange,
  onDayOfMonthChange,
}: ReminderPickerProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showOffsetModal, setShowOffsetModal] = useState(false);
  const [showRepeatModal, setShowRepeatModal] = useState(false);
  
  const currentDate = reminderTime ? new Date(reminderTime) : new Date();
  
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(currentDate);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      onTimeChange(newDate.getTime());
    }
  };
  
  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(currentDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      onTimeChange(newDate.getTime());
    }
  };
  
  const toggleDayOfWeek = (day: number) => {
    if (repeatDaysOfWeek.includes(day)) {
      onDaysOfWeekChange(repeatDaysOfWeek.filter(d => d !== day));
    } else {
      onDaysOfWeekChange([...repeatDaysOfWeek, day].sort());
    }
  };
  
  const getOffsetLabel = () => {
    const option = REMINDER_OFFSETS.find(o => o.value === reminderOffset);
    return option?.labelRu || 'Выбрать';
  };
  
  const getRepeatLabel = () => {
    const option = REPEAT_OPTIONS.find(o => o.value === repeatFrequency);
    return option?.labelRu || 'Не повторять';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Настройки напоминания</Text>
      
      {/* Date & Time Row */}
      <View style={styles.row}>
        <TouchableOpacity 
          style={styles.pickerButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.pickerLabel}>Дата</Text>
          <Text style={styles.pickerValue}>
            {format(currentDate, 'd MMM yyyy', { locale: ru })}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.pickerButton}
          onPress={() => setShowTimePicker(true)}
        >
          <Text style={styles.pickerLabel}>Время</Text>
          <Text style={styles.pickerValue}>
            {format(currentDate, 'HH:mm')}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Offset Selector */}
      <TouchableOpacity 
        style={styles.optionButton}
        onPress={() => setShowOffsetModal(true)}
      >
        <Text style={styles.optionLabel}>Напомнить</Text>
        <Text style={styles.optionValue}>{getOffsetLabel()} →</Text>
      </TouchableOpacity>
      
      {/* Repeat Selector */}
      <TouchableOpacity 
        style={styles.optionButton}
        onPress={() => setShowRepeatModal(true)}
      >
        <Text style={styles.optionLabel}>Повтор</Text>
        <Text style={styles.optionValue}>{getRepeatLabel()} →</Text>
      </TouchableOpacity>
      
      {/* Days of Week (shown when weekly repeat) */}
      {repeatFrequency === 'weekly' && (
        <View style={styles.daysContainer}>
          <Text style={styles.daysLabel}>Дни недели</Text>
          <View style={styles.daysRow}>
            {DAYS_OF_WEEK.map(day => (
              <TouchableOpacity
                key={day.value}
                style={[
                  styles.dayButton,
                  repeatDaysOfWeek.includes(day.value) && styles.dayButtonSelected
                ]}
                onPress={() => toggleDayOfWeek(day.value)}
              >
                <Text style={[
                  styles.dayText,
                  repeatDaysOfWeek.includes(day.value) && styles.dayTextSelected
                ]}>
                  {day.labelRu}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      
      {/* Day of Month (shown when monthly repeat) */}
      {repeatFrequency === 'monthly' && (
        <View style={styles.monthDayContainer}>
          <Text style={styles.daysLabel}>День месяца: {repeatDayOfMonth || currentDate.getDate()}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.monthDaysRow}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.monthDayButton,
                    (repeatDayOfMonth || currentDate.getDate()) === day && styles.dayButtonSelected
                  ]}
                  onPress={() => onDayOfMonthChange(day)}
                >
                  <Text style={[
                    styles.monthDayText,
                    (repeatDayOfMonth || currentDate.getDate()) === day && styles.dayTextSelected
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
      
      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={currentDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}
      
      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={currentDate}
          mode="time"
          display="default"
          onChange={handleTimeChange}
          is24Hour={true}
        />
      )}
      
      {/* Offset Modal */}
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
            <Text style={styles.modalTitle}>Напомнить</Text>
            {REMINDER_OFFSETS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  reminderOffset === option.value && styles.modalOptionSelected
                ]}
                onPress={() => {
                  onOffsetChange(option.value);
                  setShowOffsetModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  reminderOffset === option.value && styles.modalOptionTextSelected
                ]}>
                  {option.labelRu}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      
      {/* Repeat Modal */}
      <Modal
        visible={showRepeatModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRepeatModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRepeatModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Повтор</Text>
            {REPEAT_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  repeatFrequency === option.value && styles.modalOptionSelected
                ]}
                onPress={() => {
                  onRepeatChange(option.value);
                  setShowRepeatModal(false);
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  repeatFrequency === option.value && styles.modalOptionTextSelected
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
    marginVertical: 12,
    padding: 12,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E74C3C',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  pickerButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E74C3C',
  },
  pickerLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  pickerValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  optionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 15,
    color: '#333',
  },
  optionValue: {
    fontSize: 15,
    color: '#E74C3C',
    fontWeight: '500',
  },
  daysContainer: {
    marginTop: 8,
  },
  daysLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  dayButtonSelected: {
    backgroundColor: '#E74C3C',
    borderColor: '#E74C3C',
  },
  dayText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  monthDayContainer: {
    marginTop: 8,
  },
  monthDaysRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 8,
  },
  monthDayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  monthDayText: {
    fontSize: 14,
    color: '#333',
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
    backgroundColor: '#FFEBEE',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalOptionTextSelected: {
    color: '#E74C3C',
    fontWeight: '600',
  },
});
