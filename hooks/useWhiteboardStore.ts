import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Path, StickyNote, BoardImage, BoardFile, UserAwareness } from '../types';

// Y.js Websocket Server URL - to be provided by Cloudflare Workers
// This will be set via an environment variable in Vercel
const Y_WEBSOCKET_SERVER_URL = 'wss://demos.yjs.dev';

const USER_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];

export const useWhiteboardStore = (roomId: string | null, passcode: string | null, userName: string, isCreator: boolean) => {
  const [paths, setPaths] = useState<Path[]>([]);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [images, setImages] = useState<BoardImage[]>([]);
  const [files, setFiles] = useState<BoardFile[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const [remoteUsers, setRemoteUsers] = useState<UserAwareness[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const awarenessRef = useRef<any>(null);

  useEffect(() => {
    if (!roomId) return;

    console.log(`[YJS-EFFECT] Init: room=${roomId}, user=${userName}, creator=${isCreator}, pw=${passcode ? 'Yes' : 'No'}`);

    // Reset states
    setConnectionError(null);
    setIsConnected(false);
    setIsAuthenticating(true);

    // Cleanup previous connection
    if (providerRef.current) {
      console.log('[YJS-EFFECT] Destroying previous provider.');
      providerRef.current.destroy();
    }
    if (ydocRef.current) {
      ydocRef.current.destroy();
    }

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;
    console.log('[YJS-DEBUG] New Y.Doc() toJSON():', ydoc.toJSON());

    const internalRoomName = `${roomId}`;
    console.log(`[YJS-SETUP] Creating new provider for room: ${internalRoomName}`);

    const provider = new WebsocketProvider(
      Y_WEBSOCKET_SERVER_URL,
      internalRoomName,
      ydoc,
      {
        connect: false // We will connect manually after auth logic is handled
      }
    );
    providerRef.current = provider;
    awarenessRef.current = provider.awareness;

    // --- Event Listeners for Debugging ---
    provider.on('status', ({ connected }: { connected: boolean }) => {
      console.log(`[YJS-EVENT] Connected: ${connected}`);
      setIsConnected(connected || false);
      if (connected) {
        setIsAuthenticating(false);
      }
    });

    provider.on('synced', ({ synced }: { synced: boolean }) => {
        console.log(`[YJS-EVENT] Synced: ${synced}`);
    });


    
    // awarenessRef.current.on('change', (changes: any) => {
    //     console.log(`[YJS-AWARENESS] Change: added=${changes.added.length}, updated=${changes.updated.length}, removed=${changes.removed.length}`);
    //     const states = Array.from(awarenessRef.current.getStates().entries());
    //     const users = states
    //         .filter(([clientId, state]: [number, any]) => clientId !== ydoc.clientID && state.user)
    //         .map(([clientId, state]: [number, any]) => ({ clientId, user: state.user, cursor: state.cursor }));
    //     setRemoteUsers(users);
    // });

    // --- Data Sync Setup ---
    const yPaths = ydoc.getArray<Path>('paths');
    const yNotes = ydoc.getMap<StickyNote>('notes');
    const yImages = ydoc.getMap<BoardImage>('images');
    const yFiles = ydoc.getMap<BoardFile>('files');

    const syncData = () => {
        console.log('[YJS-DEBUG] yPaths.toArray():', yPaths.toArray());
        setPaths(yPaths.toArray() as Path[]);
        setNotes(Array.from(yNotes.values()) as StickyNote[]);
        setImages(Array.from(yImages.values()) as BoardImage[]);
        setFiles(Array.from(yFiles.values()) as BoardFile[]);
    };
    syncData(); // Initial sync
    yPaths.observe(syncData);
    yNotes.observe(syncData);
    yImages.observe(syncData);
    yFiles.observe(syncData);

    // Connect to WebSocket after setting up awareness
    provider.connect();
  }, [roomId, passcode, userName, isCreator]);

  // Cursor Helper
  const updateCursor = useCallback((point: {x: number, y: number} | null) => {
    if (awarenessRef.current) {
        awarenessRef.current.setLocalStateField('cursor', point);
    }
  }, []);

  // Mutation Helpers
  const addPath = useCallback((path: Path) => ydocRef.current?.getArray<Path>('paths').push([path]), []);
  const deletePaths = useCallback((pathIds: string[]) => {
    const yPaths = ydocRef.current?.getArray<Path>('paths');
    if (!yPaths) return;
    ydocRef.current?.transact(() => {
      const current = yPaths.toArray() as any[];
      const indexesToDelete: number[] = [];
      current.forEach((p: any, i: number) => { if (pathIds.includes(p.id)) indexesToDelete.push(i); });
      indexesToDelete.sort((a, b) => b - a).forEach(i => yPaths.delete(i, 1));
    });
  }, []);

  const clearBoard = useCallback(() => {
    ydocRef.current?.transact(() => {
      const p = ydocRef.current?.getArray<Path>('paths');
      if (p) p.delete(0, p.length);
      ydocRef.current?.getMap('notes').clear();
      ydocRef.current?.getMap('images').clear();
      ydocRef.current?.getMap('files').clear();
    });
  }, []);

  const addNote = useCallback((note: StickyNote) => ydocRef.current?.getMap('notes').set(note.id, note), []);
  const updateNote = useCallback((note: StickyNote) => ydocRef.current?.getMap('notes').set(note.id, note), []);
  const deleteNote = useCallback((id: string) => ydocRef.current?.getMap('notes').delete(id), []);

  const addImage = useCallback((img: BoardImage) => ydocRef.current?.getMap('images').set(img.id, img), []);
  const updateImage = useCallback((img: BoardImage) => ydocRef.current?.getMap('images').set(img.id, img), []);
  const deleteImage = useCallback((id: string) => ydocRef.current?.getMap('images').delete(id), []);

  const addFile = useCallback((file: BoardFile) => ydocRef.current?.getMap('files').set(file.id, file), []);
  const updateFile = useCallback((file: BoardFile) => ydocRef.current?.getMap('files').set(file.id, file), []);
  const deleteFile = useCallback((id: string) => ydocRef.current?.getMap('files').delete(id), []);

  return {
    paths, notes, images, files, isConnected, remoteUsers, connectionError, isAuthenticating,
    updateCursor, addPath, deletePaths, clearBoard,
    addNote, updateNote, deleteNote, addImage, updateImage, deleteImage, addFile, updateFile, deleteFile
  };
};