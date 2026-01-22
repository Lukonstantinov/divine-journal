import * as SQLite from 'expo-sqlite';
import { Note, Tag, NoteCategory } from '../types';
import { DEFAULT_TAGS } from '../constants/defaultTags';

let db: SQLite.SQLiteDatabase | null = null;

// Database version for migrations
const DB_VERSION = 2;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  
  db = await SQLite.openDatabaseAsync('divine-journal.db');
  await initDatabase();
  return db;
}

async function initDatabase(): Promise<void> {
  if (!db) return;
  
  // Create tables if they don't exist
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT,
      plainText TEXT,
      createdAt INTEGER,
      updatedAt INTEGER,
      dateFor INTEGER,
      isDeleted INTEGER DEFAULT 0,
      syncStatus TEXT DEFAULT 'pending'
    );
    
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE,
      color TEXT,
      icon TEXT
    );
    
    CREATE TABLE IF NOT EXISTS note_tags (
      noteId TEXT,
      tagId TEXT,
      PRIMARY KEY (noteId, tagId),
      FOREIGN KEY (noteId) REFERENCES notes(id),
      FOREIGN KEY (tagId) REFERENCES tags(id)
    );
    
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      noteId TEXT,
      remindAt INTEGER,
      isTriggered INTEGER DEFAULT 0,
      notificationId TEXT,
      FOREIGN KEY (noteId) REFERENCES notes(id)
    );
    
    CREATE TABLE IF NOT EXISTS db_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  
  // Run migrations
  await runMigrations();
  
  // Insert default tags if needed
  await insertDefaultTags();
}

async function runMigrations(): Promise<void> {
  if (!db) return;
  
  // Get current version
  let currentVersion = 0;
  try {
    const result = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM db_meta WHERE key = ?',
      ['db_version']
    );
    if (result) {
      currentVersion = parseInt(result.value, 10);
    }
  } catch (e) {
    // Table might not exist yet
  }
  
  // Migration 1 -> 2: Add category and reminder columns to notes
  if (currentVersion < 2) {
    console.log('Running migration to version 2...');
    
    // Check if columns exist before adding
    const tableInfo = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(notes)"
    );
    const columnNames = tableInfo.map(col => col.name);
    
    if (!columnNames.includes('category')) {
      await db.execAsync(`ALTER TABLE notes ADD COLUMN category TEXT DEFAULT 'note'`);
    }
    if (!columnNames.includes('reminderTime')) {
      await db.execAsync(`ALTER TABLE notes ADD COLUMN reminderTime INTEGER`);
    }
    if (!columnNames.includes('reminderOffset')) {
      await db.execAsync(`ALTER TABLE notes ADD COLUMN reminderOffset INTEGER`);
    }
    if (!columnNames.includes('notificationId')) {
      await db.execAsync(`ALTER TABLE notes ADD COLUMN notificationId TEXT`);
    }
    if (!columnNames.includes('repeatFrequency')) {
      await db.execAsync(`ALTER TABLE notes ADD COLUMN repeatFrequency TEXT DEFAULT 'none'`);
    }
    if (!columnNames.includes('repeatDaysOfWeek')) {
      await db.execAsync(`ALTER TABLE notes ADD COLUMN repeatDaysOfWeek TEXT`);
    }
    if (!columnNames.includes('repeatDayOfMonth')) {
      await db.execAsync(`ALTER TABLE notes ADD COLUMN repeatDayOfMonth INTEGER`);
    }
    
    // Migrate existing notes: set category based on note_tags
    // If note has 'tag-dream' -> category = 'dream', etc.
    await migrateExistingNotesCategories();
    
    console.log('Migration to version 2 complete.');
  }
  
  // Update version
  await db.runAsync(
    'INSERT OR REPLACE INTO db_meta (key, value) VALUES (?, ?)',
    ['db_version', DB_VERSION.toString()]
  );
}

async function migrateExistingNotesCategories(): Promise<void> {
  if (!db) return;
  
  // Get all notes that have tags but no category set (or default 'note')
  const notes = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM notes WHERE category IS NULL OR category = 'note'"
  );
  
  for (const note of notes) {
    // Get the first tag for this note
    const tag = await db.getFirstAsync<{ tagId: string }>(
      'SELECT tagId FROM note_tags WHERE noteId = ? LIMIT 1',
      [note.id]
    );
    
    if (tag) {
      // Convert tag ID to category: 'tag-dream' -> 'dream'
      const category = tag.tagId.replace('tag-', '') as NoteCategory;
      if (['note', 'dream', 'revelation', 'reminder'].includes(category)) {
        await db.runAsync(
          'UPDATE notes SET category = ? WHERE id = ?',
          [category, note.id]
        );
      }
    }
  }
}

async function insertDefaultTags(): Promise<void> {
  if (!db) return;
  
  for (const tag of DEFAULT_TAGS) {
    try {
      await db.runAsync(
        'INSERT OR IGNORE INTO tags (id, name, color, icon) VALUES (?, ?, ?, ?)',
        [tag.id, tag.name, tag.color, tag.icon]
      );
    } catch (e) {
      // Ignore duplicate errors
    }
  }
}

// ============ NOTE OPERATIONS ============

export async function getAllNotes(): Promise<Note[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM notes WHERE isDeleted = 0 ORDER BY dateFor DESC, createdAt DESC'
  );
  return rows.map(rowToNote);
}

export async function getNoteById(id: string): Promise<Note | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<any>(
    'SELECT * FROM notes WHERE id = ?',
    [id]
  );
  return row ? rowToNote(row) : null;
}

export async function createNote(note: Note): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO notes (
      id, title, content, plainText, createdAt, updatedAt, dateFor, 
      isDeleted, syncStatus, category, reminderTime, reminderOffset, 
      notificationId, repeatFrequency, repeatDaysOfWeek, repeatDayOfMonth
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      note.id,
      note.title,
      note.content,
      note.plainText,
      note.createdAt,
      note.updatedAt,
      note.dateFor,
      note.isDeleted ? 1 : 0,
      note.syncStatus,
      note.category || 'note',
      note.reminderTime || null,
      note.reminderOffset || null,
      note.notificationId || null,
      note.repeatFrequency || 'none',
      note.repeatDaysOfWeek ? JSON.stringify(note.repeatDaysOfWeek) : null,
      note.repeatDayOfMonth || null,
    ]
  );
}

export async function updateNote(note: Note): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE notes SET 
      title = ?, content = ?, plainText = ?, updatedAt = ?, dateFor = ?,
      syncStatus = ?, category = ?, reminderTime = ?, reminderOffset = ?,
      notificationId = ?, repeatFrequency = ?, repeatDaysOfWeek = ?, repeatDayOfMonth = ?
    WHERE id = ?`,
    [
      note.title,
      note.content,
      note.plainText,
      note.updatedAt,
      note.dateFor,
      note.syncStatus,
      note.category || 'note',
      note.reminderTime || null,
      note.reminderOffset || null,
      note.notificationId || null,
      note.repeatFrequency || 'none',
      note.repeatDaysOfWeek ? JSON.stringify(note.repeatDaysOfWeek) : null,
      note.repeatDayOfMonth || null,
      note.id,
    ]
  );
}

export async function deleteNote(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE notes SET isDeleted = 1, updatedAt = ?, syncStatus = ? WHERE id = ?',
    [Date.now(), 'pending', id]
  );
}

export async function searchNotes(query: string): Promise<Note[]> {
  const database = await getDatabase();
  const searchTerm = `%${query}%`;
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM notes 
     WHERE isDeleted = 0 AND (title LIKE ? OR plainText LIKE ?)
     ORDER BY dateFor DESC, createdAt DESC`,
    [searchTerm, searchTerm]
  );
  return rows.map(rowToNote);
}

export async function getNotesByDateRange(startDate: number, endDate: number): Promise<Note[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM notes 
     WHERE isDeleted = 0 AND dateFor >= ? AND dateFor <= ?
     ORDER BY dateFor DESC, createdAt DESC`,
    [startDate, endDate]
  );
  return rows.map(rowToNote);
}

export async function getNotesByCategory(category: NoteCategory): Promise<Note[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM notes 
     WHERE isDeleted = 0 AND category = ?
     ORDER BY dateFor DESC, createdAt DESC`,
    [category]
  );
  return rows.map(rowToNote);
}

// Helper to convert DB row to Note object
function rowToNote(row: any): Note {
  return {
    id: row.id,
    title: row.title || '',
    content: row.content || '',
    plainText: row.plainText || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    dateFor: row.dateFor,
    isDeleted: row.isDeleted === 1,
    syncStatus: row.syncStatus || 'pending',
    category: row.category || 'note',
    reminderTime: row.reminderTime || undefined,
    reminderOffset: row.reminderOffset || undefined,
    notificationId: row.notificationId || undefined,
    repeatFrequency: row.repeatFrequency || 'none',
    repeatDaysOfWeek: row.repeatDaysOfWeek ? JSON.parse(row.repeatDaysOfWeek) : undefined,
    repeatDayOfMonth: row.repeatDayOfMonth || undefined,
  };
}

// ============ TAG OPERATIONS (for backward compatibility) ============

export async function getAllTags(): Promise<Tag[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Tag>('SELECT * FROM tags');
  return rows;
}

export async function getTagsForNote(noteId: string): Promise<Tag[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Tag>(
    `SELECT t.* FROM tags t
     INNER JOIN note_tags nt ON t.id = nt.tagId
     WHERE nt.noteId = ?`,
    [noteId]
  );
  return rows;
}

export async function setNoteCategory(noteId: string, category: NoteCategory): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE notes SET category = ?, updatedAt = ? WHERE id = ?',
    [category, Date.now(), noteId]
  );
}

// Legacy function - kept for compatibility
export async function setNoteTags(noteId: string, tagIds: string[]): Promise<void> {
  const database = await getDatabase();
  
  // Remove existing tags
  await database.runAsync('DELETE FROM note_tags WHERE noteId = ?', [noteId]);
  
  // Add new tags
  for (const tagId of tagIds) {
    await database.runAsync(
      'INSERT INTO note_tags (noteId, tagId) VALUES (?, ?)',
      [noteId, tagId]
    );
  }
  
  // Also update category based on first tag
  if (tagIds.length > 0) {
    const category = tagIds[0].replace('tag-', '') as NoteCategory;
    if (['note', 'dream', 'revelation', 'reminder'].includes(category)) {
      await database.runAsync(
        'UPDATE notes SET category = ? WHERE id = ?',
        [category, noteId]
      );
    }
  }
}
