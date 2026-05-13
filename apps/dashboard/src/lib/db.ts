import Dexie, { type EntityTable } from 'dexie';

interface Project {
  id: string;
}

const db = new Dexie('ProjectsDatabase') as Dexie & { projects: EntityTable<Project, 'id'> };

db.version(1).stores({ projects: '++id' });

export { db };
