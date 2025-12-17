
export enum ToolType {
  SELECT = 'SELECT',
  PEN = 'PEN',
  ERASER = 'ERASER',
  NOTE = 'NOTE',
  IMAGE = 'IMAGE'
}

export interface Point {
  x: number;
  y: number;
}

export interface Path {
  id: string;
  points: Point[];
  color: string;
  width: number;
}

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  width: number;
  height: number;
  authorId?: string;
  authorName?: string;
  authorColor?: string;
}

export interface BoardImage {
  id: string;
  x: number;
  y: number;
  src: string;
  width: number;
  height: number;
  title?: string;
}

export interface BoardFile {
  id: string;
  x: number;
  y: number;
  fileName: string;
  fileType: string;
  data: string; // Base64 data URI
  width: number;
  height: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface UserAwareness {
  clientId: number;
  user: {
    name: string;
    color: string;
  };
  cursor: Point | null;
}

export type BoardItem = StickyNote | BoardImage | BoardFile;

export const STICKY_COLORS = [
  '#fef3c7', // yellow
  '#dcfce7', // green
  '#dbeafe', // blue
  '#fce7f3', // pink
  '#f3f4f6', // gray
];
