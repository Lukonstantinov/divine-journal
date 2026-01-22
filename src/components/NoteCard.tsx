import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Note } from '../types';
import { getCategory } from '../constants/defaultTags';

interface NoteCardProps {
  note: Note;
  onPress: (note: Note) => void;
}

export function NoteCard({ note, onPress }: NoteCardProps) {
  const category = getCategory(note.category);
  
  const preview = note.plainText.length > 100 
    ? note.plainText.substring(0, 100) + '...' 
    : note.plainText;

  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: category.backgroundColor }]} 
      onPress={() => onPress(note)}
      activeOpacity={0.7}
    >
      {/* Header: Date on left, Category badge on right */}
      <View style={styles.header}>
        <Text style={styles.date}>
          {format(new Date(note.dateFor), 'd MMM yyyy', { locale: ru })}
        </Text>
        <View style={[styles.categoryBadge, { backgroundColor: category.color + '25' }]}>
          <Text style={styles.categoryIcon}>{category.icon}</Text>
          <Text style={[styles.categoryName, { color: category.color }]}>
            {category.nameRu}
          </Text>
        </View>
      </View>
      
      {/* Title (if exists) */}
      {note.title ? (
        <Text style={styles.title} numberOfLines={1}>{note.title}</Text>
      ) : null}
      
      {/* Content preview */}
      <Text style={styles.preview} numberOfLines={2}>{preview}</Text>
      
      {/* Footer: Time, and reminder info if applicable */}
      <View style={styles.footer}>
        <Text style={styles.time}>
          {format(new Date(note.createdAt), 'HH:mm')}
        </Text>
        {note.category === 'reminder' && note.reminderTime && (
          <Text style={styles.reminderInfo}>
            ⏰ {format(new Date(note.reminderTime), 'd MMM HH:mm', { locale: ru })}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  date: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 5,
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  preview: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  time: {
    fontSize: 12,
    color: '#888',
  },
  reminderInfo: {
    fontSize: 12,
    color: '#E74C3C',
    fontWeight: '500',
  },
});
