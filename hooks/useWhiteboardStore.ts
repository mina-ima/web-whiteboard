import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Path, StickyNote, BoardImage, BoardFile, UserAwareness } from '../types';

// デバッグのため、一時的にY.js公式のデモサーバーに切り替え
// Websocket Server URL（?room= まで含む環境変数）
// const Y_WEBSOCKET_SERVER_URL =
//   import.meta.env.VITE_Y_WEBSOCKET_SERVER_URL ||
//   'ws://localhost:1234/websocket?room=';
const Y_WEBSOCKET_SERVER_URL_FOR_DEBUG = 'wss://web-whiteboard-signaling.minamidenshi.workers.dev/websocket';

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

    console.log(`[YJS] Init: room=${roomId}, user=${userName}, passcode=${passcode ? 'Yes' : 'No'}`);

    // Reset state
    setConnectionError(null);
    setIsConnected(false);
    setIsAuthenticating(true);

    // Cleanup previous session
    if (providerRef.current) providerRef.current.destroy();
    if (ydocRef.current) ydocRef.current.destroy();

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // デバッグ用のルーム名。他のユーザーと衝突しないようにプレフィックスをつける
    const internalRoomName = `web-whiteboard-debug-${roomId}`;

    // URL生成ロジックをデバッグ用に変更
    // let wsUrl = `${Y_WEBSOCKET_SERVER_URL}${internalRoomName}`;
    // if (passcode) {
    //   wsUrl += `&passcode=${passcode}`;
    // }
    // console.log('[YJS-SETUP] WS URL:', wsUrl);

    const provider = new WebsocketProvider(
      Y_WEBSOCKET_SERVER_URL_FOR_DEBUG,
      internalRoomName, // roomNameを第2引数として渡す
      ydoc,
      {
        connect: false, // connect は後で手動で実行
        params: { passcode: passcode || '' },
      }
    );

    providerRef.current = provider;
    awarenessRef.current = provider.awareness;

    // 接続イベント
    provider.on('status', (event: any) => {
      console.log('[YJS-EVENT] status:', event);
      const isConnected = event.status === 'connected';
      setIsConnected(isConnected);
      if (isConnected) {
        setIsAuthenticating(false);
    }
  });

    provider.on('synced', ({ synced }: { synced: boolean }) => {
      console.log(`[YJS] Synced: ${synced}`);
    });

    // Awareness change イベント復活
    awarenessRef.current.on('change', (changes: any) => {
      console.log(
        `[YJS-AWARENESS] added=${changes.added.length} updated=${changes.updated.length} removed=${changes.removed.length}`
      );

      const states = Array.from(awarenessRef.current.getStates().entries());
      const users = states
        .filter(([clientId, state]: [number, any]) => clientId !== ydoc.clientID && state.user)
        .map(([clientId, state]: [number, any]) => ({
          clientId,
          user: state.user,
          cursor: state.cursor
        }));
      setRemoteUsers(users);
    });

    // Data Sync Setup
    const yPaths = ydoc.getArray<Path>('paths');
    const yNotes = ydoc.getMap<StickyNote>('notes');
    const yImages = ydoc.getMap<BoardImage>('images');
    const yFiles = ydoc.getMap<BoardFile>('files');

    const syncData = () => {
      setPaths(yPaths.toArray());
      setNotes(Array.from(yNotes.values()));
      setImages(Array.from(yImages.values()));
      setFiles(Array.from(yFiles.values()));
    };

    syncData();

    yPaths.observe(syncData);
    yNotes.observe(syncData);
    yImages.observe(syncData);
    yFiles.observe(syncData);

    // WebSocket Connect
    provider.connect();
  }, [roomId, passcode, userName, isCreator]);

  // Cursor Helper
  const updateCursor = useCallback((point: { x: number; y: number } | null) => {
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
      current.forEach((p: any, i: number) => {
        if (pathIds.includes(p.id)) indexesToDelete.push(i);
      });
      indexesToDelete.sort((a, b) => b - a).forEach((i) => yPaths.delete(i, 1));
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

  const addNote = useCallback(
    (note: StickyNote) => ydocRef.current?.getMap('notes').set(note.id, note),
    []
  );

  const updateNote = useCallback(
    (note: StickyNote) => ydocRef.current?.getMap('notes').set(note.id, note),
    []
  );

  const deleteNote = useCallback((id: string) => ydocRef.current?.getMap('notes').delete(id), []);

  const addImage = useCallback(
    (img: BoardImage) => ydocRef.current?.getMap('images').set(img.id, img),
    []
  );

  const updateImage = useCallback(
    (img: BoardImage) => ydocRef.current?.getMap('images').set(img.id, img),
    []
  );

  const deleteImage = useCallback((id: string) => ydocRef.current?.getMap('images').delete(id), []);

  const addFile = useCallback(
    (file: BoardFile) => ydocRef.current?.getMap('files').set(file.id, file),
    []
  );

  const updateFile = useCallback(
    (file: BoardFile) => ydocRef.current?.getMap('files').set(file.id, file),
    []
  );

  const deleteFile = useCallback((id: string) => ydocRef.current?.getMap('files').delete(id), []);

  return {
    paths,
    notes,
    images,
    files,
    isConnected,
    remoteUsers,
    connectionError,
    isAuthenticating,

    updateCursor,
    addPath,
    deletePaths,
    clearBoard,

    addNote,
    updateNote,
    deleteNote,
    addImage,
    updateImage,
    deleteImage,
    addFile,
    updateFile,
    deleteFile
  };
};
