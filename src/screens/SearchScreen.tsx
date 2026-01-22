import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useNoteStore } from '../stores/noteStore';
import { NoteCard } from '../components/NoteCard';
import { Note, NoteCategory } from '../types';
import { CATEGORIES } from '../constants/defaultTags';

interface SearchScreenProps {
  navigation: any;
}

export function SearchScreen({ navigation }: SearchScreenProps) {
  const { searchNotes } = useNoteStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Note[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<NoteCategory | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (query.trim() || selectedCategory) {
      performSearch();
    } else {
      setResults([]);
      setHasSearched(false);
    }
  }, [query, selectedCategory]);

  const performSearch = async () => {
    let searchResults = await searchNotes(query);
    
    // Filter by category if selected
    if (selectedCategory) {
      searchResults = searchResults.filter(note => note.category === selectedCategory);
    }
    
    setResults(searchResults);
    setHasSearched(true);
  };

  const handleNotePress = (note: Note) => {
    navigation.navigate('EditNote', { noteId: note.id });
  };

  const toggleCategoryFilter = (category: NoteCategory) => {
    if (selectedCategory === category) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(category);
    }
  };

  const categories = Object.values(CATEGORIES);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск по записям..."
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={() => setQuery('')}
          >
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filters */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filtersLabel}>Фильтр по категории:</Text>
        <View style={styles.filters}>
          {categories.map(cat => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterButton,
                  { 
                    backgroundColor: isSelected ? cat.color : cat.backgroundColor,
                    borderColor: cat.color,
                  }
                ]}
                onPress={() => toggleCategoryFilter(cat.id)}
              >
                <Text style={styles.filterIcon}>{cat.icon}</Text>
                <Text style={[
                  styles.filterText,
                  { color: isSelected ? '#FFFFFF' : cat.color }
                ]}>
                  {cat.nameRu}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Results */}
      {hasSearched && results.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>Ничего не найдено</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NoteCard note={item} onPress={handleNotePress} />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={styles.resultsCount}>
                Найдено: {results.length}
              </Text>
            ) : null
          }
        />
      )}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 8,
  },
  clearText: {
    fontSize: 16,
    color: '#999',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  filtersLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 10,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 5,
  },
  filterIcon: {
    fontSize: 14,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 20,
  },
  resultsCount: {
    fontSize: 13,
    color: '#666',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});
