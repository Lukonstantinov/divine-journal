import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isToday,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { useNoteStore } from '../stores/noteStore';
import { NoteCard } from '../components/NoteCard';
import { Note } from '../types';

interface CalendarScreenProps {
  navigation: any;
}

export function CalendarScreen({ navigation }: CalendarScreenProps) {
  const { getNotesByDate } = useNoteStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [notesForDate, setNotesForDate] = useState<Note[]>([]);
  const [daysWithNotes, setDaysWithNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadMonthData();
  }, [currentMonth]);

  useEffect(() => {
    loadNotesForDate();
  }, [selectedDate]);
  
  // Reload when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMonthData();
      loadNotesForDate();
    });
    return unsubscribe;
  }, [navigation, currentMonth, selectedDate]);

  const loadMonthData = async () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const notes = await getNotesByDate(start.getTime(), end.getTime());
    
    const days = new Set<string>();
    notes.forEach(note => {
      days.add(format(new Date(note.dateFor), 'yyyy-MM-dd'));
    });
    setDaysWithNotes(days);
  };

  const loadNotesForDate = async () => {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const notes = await getNotesByDate(startOfDay.getTime(), endOfDay.getTime());
    setNotesForDate(notes);
  };

  const handleNotePress = (note: Note) => {
    navigation.navigate('EditNote', { noteId: note.id });
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Generate calendar days including padding for week alignment
  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
      </View>

      {/* Month Navigation */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={goToPreviousMonth} style={styles.navArrow}>
          <Text style={styles.navArrowText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {format(currentMonth, 'LLLL yyyy', { locale: ru })}
        </Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navArrow}>
          <Text style={styles.navArrowText}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendar}>
        {/* Week day headers */}
        <View style={styles.weekDays}>
          {weekDays.map((day, index) => (
            <View key={index} style={styles.weekDayCell}>
              <Text style={styles.weekDayText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Days grid */}
        <View style={styles.daysGrid}>
          {calendarDays.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const hasNote = daysWithNotes.has(dateKey);
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);

            return (
              <TouchableOpacity
                key={index}
                style={styles.dayCell}
                onPress={() => setSelectedDate(day)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.dayInner,
                  isSelected && styles.selectedDayInner,
                  isTodayDate && !isSelected && styles.todayInner,
                ]}>
                  <Text style={[
                    styles.dayText,
                    !isCurrentMonth && styles.otherMonthText,
                    isSelected && styles.selectedDayText,
                    isTodayDate && !isSelected && styles.todayText,
                  ]}>
                    {day.getDate()}
                  </Text>
                </View>
                {hasNote && <View style={styles.noteDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Notes for selected date */}
      <View style={styles.notesSection}>
        <Text style={styles.notesTitle}>
          {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
        </Text>
        
        {notesForDate.length === 0 ? (
          <Text style={styles.noNotes}>Нет записей на этот день</Text>
        ) : (
          <FlatList
            data={notesForDate}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <NoteCard note={item} onPress={handleNotePress} />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.notesList}
          />
        )}
      </View>
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
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  navArrow: {
    padding: 8,
  },
  navArrowText: {
    fontSize: 22,
    color: '#4A90D9',
    fontWeight: '600',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize',
  },
  calendar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDayInner: {
    backgroundColor: '#4A90D9',
  },
  todayInner: {
    borderWidth: 2,
    borderColor: '#4A90D9',
  },
  dayText: {
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
  },
  otherMonthText: {
    color: '#CCC',
  },
  selectedDayText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  todayText: {
    color: '#4A90D9',
    fontWeight: '600',
  },
  noteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F39C12',
    position: 'absolute',
    bottom: 4,
  },
  notesSection: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: 'capitalize',
  },
  notesList: {
    paddingBottom: 20,
  },
  noNotes: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginTop: 30,
  },
});
