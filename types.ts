
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

export interface PenStyle {
  id: string;
  label: string;
  color: string;
  width: number;
  cursorColor?: string;
}

export const PEN_STYLES: PenStyle[] = [
  { id: 'black', label: '黒', color: '#111827', width: 3 },
  { id: 'red', label: '赤', color: '#ef4444', width: 3 },
  { id: 'blue', label: '青', color: '#3b82f6', width: 3 },
  { id: 'green', label: '緑', color: '#22c55e', width: 3 },
  { id: 'orange', label: 'オレンジ', color: '#ff6b00', width: 3 },
  { id: 'pink', label: 'ピンク', color: '#ff3ea5', width: 3 },
  {
    id: 'highlighter',
    label: '蛍光ペン',
    color: 'rgba(255, 244, 79, 0.55)',
    width: 12,
    cursorColor: '#ffeb3b',
  },
];
