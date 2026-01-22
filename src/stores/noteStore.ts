import { create } from 'zustand';
import { Note, NoteCategory } from '../types';
import * as db from '../lib/database';

interface NoteStore {
  notes: Note[];
  isLoading: boolean;
  
  // Actions
  loadNotes: () => Promise<void>;
  addNote: (note: Note) => Promise<void>;
  updateNote: (note: Note) => Promise<void>;
  removeNote: (id: string) => Promise<void>;
  searchNotes: (query: string) => Promise<Note[]>;
  getNotesByDate: (startDate: number, endDate: number) => Promise<Note[]>;
  getNotesByCategory: (category: NoteCategory) => Promise<Note[]>;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  isLoading: false,

  loadNotes: async () => {
    set({ isLoading: true });
    try {
      const notes = await db.getAllNotes();
      set({ notes, isLoading: false });
    } catch (error) {
      console.error('Error loading notes:', error);
      set({ isLoading: false });
    }
  },

  addNote: async (note: Note) => {
    try {
      await db.createNote(note);
      // Reload notes to get fresh data
      await get().loadNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      throw error;
    }
  },

  updateNote: async (note: Note) => {
    try {
      await db.updateNote(note);
      // Reload notes to get fresh data
      await get().loadNotes();
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  },

  removeNote: async (id: string) => {
    try {
      await db.deleteNote(id);
      // Remove from local state immediately
      set(state => ({
        notes: state.notes.filter(n => n.id !== id)
      }));
    } catch (error) {
      console.error('Error removing note:', error);
      throw error;
    }
  },

  searchNotes: async (query: string) => {
    try {
      if (!query.trim()) {
        return get().notes;
      }
      return await db.searchNotes(query);
    } catch (error) {
      console.error('Error searching notes:', error);
      return [];
    }
  },

  getNotesByDate: async (startDate: number, endDate: number) => {
    try {
      return await db.getNotesByDateRange(startDate, endDate);
    } catch (error) {
      console.error('Error getting notes by date:', error);
      return [];
    }
  },

  getNotesByCategory: async (category: NoteCategory) => {
    try {
      return await db.getNotesByCategory(category);
    } catch (error) {
      console.error('Error getting notes by category:', error);
      return [];
    }
  },
}));
