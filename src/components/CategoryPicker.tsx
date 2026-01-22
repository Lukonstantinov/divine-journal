import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NoteCategory, Category } from '../types';
import { CATEGORIES } from '../constants/defaultTags';

interface CategoryPickerProps {
  selectedCategory: NoteCategory;
  onSelectCategory: (category: NoteCategory) => void;
}

export function CategoryPicker({ selectedCategory, onSelectCategory }: CategoryPickerProps) {
  const categories = Object.values(CATEGORIES);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Категория</Text>
      <View style={styles.categoriesContainer}>
        {categories.map((category: Category) => {
          const isSelected = selectedCategory === category.id;
          return (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                {
                  backgroundColor: isSelected ? category.color : category.backgroundColor,
                  borderColor: category.color,
                },
              ]}
              onPress={() => onSelectCategory(category.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <Text
                style={[
                  styles.categoryName,
                  { color: isSelected ? '#FFFFFF' : category.color },
                ]}
              >
                {category.nameRu}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    gap: 6,
  },
  categoryIcon: {
    fontSize: 18,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
  },
});
