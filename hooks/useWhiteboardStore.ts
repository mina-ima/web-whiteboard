import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Path, StickyNote, BoardImage, BoardFile, UserAwareness } from '../types';

type NoteMeta = Pick<StickyNote, 'id' | 'x' | 'y' | 'width' | 'height'>;
type ImageMeta = Pick<BoardImage, 'id' | 'x' | 'y' | 'width' | 'height'>;
type FileMeta = Pick<BoardFile, 'id' | 'x' | 'y' | 'width' | 'height'>;

const DEFAULT_WEBSOCKET_SERVER_URL = 'wss://web-whiteboard-signaling.minamidenshi.workers.dev/websocket';
const normalizeWebsocketUrl = (url: string) => {
  const cleaned = url.trim().replace(/\\n/g, '').replace(/\?room=.*$/, '');
  return cleaned || DEFAULT_WEBSOCKET_SERVER_URL;
};
const Y_WEBSOCKET_SERVER_URL = normalizeWebsocketUrl(
  import.meta.env.VITE_Y_WEBSOCKET_SERVER_URL || DEFAULT_WEBSOCKET_SERVER_URL
);
const CONNECTION_TIMEOUT_MS = 8000;

const USER_COLORS = [
  '#fee2e2',
  '#ffedd5',
  '#fef3c7',
  '#ecfccb',
  '#d1fae5',
  '#cffafe',
  '#dbeafe',
  '#ede9fe',
  '#fce7f3',
  '#f5f5f5',
  '#e2e8f0',
  '#e0f2fe',
];

const getOrCreateUserId = () => {
  if (typeof window === 'undefined') {
    return `user-${Math.random().toString(36).slice(2)}`;
  }
  const key = 'web-whiteboard-user-id';
  let storage: Storage | null = null;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }
  if (!storage) {
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
  }
  if (!storage) {
    return `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  const existing = storage.getItem(key);
  if (existing) return existing;
  const id = (crypto && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  storage.setItem(key, id);
  return id;
};

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
  const localUserRef = useRef<{ id: string; name: string; color: string; order: number } | null>(null);
  const localUserIdRef = useRef<string>('');

  useEffect(() => {
    if (!roomId) {
      if (providerRef.current) providerRef.current.destroy();
      if (ydocRef.current) ydocRef.current.destroy();
      providerRef.current = null;
      ydocRef.current = null;
      awarenessRef.current = null;
      setIsConnected(false);
      setIsAuthenticating(false);
      return;
    }

    let isActive = true;
    let didConnect = false;
    let authTimeout: ReturnType<typeof setTimeout> | null = null;

    const failAuthentication = (message: string) => {
      if (!isActive || didConnect) return;
      setConnectionError(message);
      setIsAuthenticating(false);
      setIsConnected(false);
    };

    console.log(`[YJS] Init: room=${roomId}, user=${userName}, passcode=${passcode ? 'Yes' : 'No'}`);

    // Reset state
    setConnectionError(null);
    setIsConnected(false);
    setIsAuthenticating(true);

    if (!localUserIdRef.current) {
      localUserIdRef.current = getOrCreateUserId();
    }

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // デバッグ用のルーム名。他のユーザーと衝突しないようにプレフィックスをつける
    const internalRoomName = `web-whiteboard-debug-${roomId}`;

    // y-websocketのURL結合の癖を逆手に取り、URLを完全に手動で構築する
    const queryParams = new URLSearchParams({ room: internalRoomName });
    if (passcode) {
      queryParams.set('passcode', passcode);
    }
    // "serverUrl + '/' + roomName" の結合で "wss://.../websocket/?room=..." となるように、
    // roomNameとしてクエリ文字列そのものを渡す
    const roomNameAsQuery = `?${queryParams.toString()}`;

    const provider = new WebsocketProvider(
      Y_WEBSOCKET_SERVER_URL,
      roomNameAsQuery,
      ydoc,
      {
        connect: false,
        params: {}, // paramsは手動で構築したので空にする
      }
    );

    providerRef.current = provider;
    awarenessRef.current = provider.awareness;
    const yUsers = ydoc.getMap<{ name: string; color: string; order: number }>('users');
    const yUserOrder = ydoc.getArray<string>('user_order');

    const handleStatus = (event: { status: string }) => {
      if (!isActive) return;
      console.log('[YJS-EVENT] status:', event);
      const connected = event.status === 'connected';
      setIsConnected(connected);
      if (connected) {
        didConnect = true;
        setConnectionError(null);
        setIsAuthenticating(false);
        if (authTimeout) clearTimeout(authTimeout);
      }
    };

    const handleConnectionError = () => {
      failAuthentication('接続に失敗しました。サーバーの状態を確認してください。');
    };

    const handleConnectionClose = (event: CloseEvent) => {
      if (!isActive || didConnect) return;
      const reason = event?.reason ? ` (${event.reason})` : '';
      failAuthentication(`接続に失敗しました${reason}。`);
    };

    provider.on('status', handleStatus);
    provider.on('connection-error', handleConnectionError);
    provider.on('connection-close', handleConnectionClose);

    const ensureLocalUser = () => {
      const userId = localUserIdRef.current;
      if (!userId) return;
      let orderIds = yUserOrder.toArray();
      if (!orderIds.includes(userId)) {
        yUserOrder.push([userId]);
        orderIds = yUserOrder.toArray();
      }
      const uniqueOrderIds: string[] = [];
      const seen = new Set<string>();
      orderIds.forEach((id) => {
        if (!seen.has(id)) {
          seen.add(id);
          uniqueOrderIds.push(id);
        }
      });
      let order = uniqueOrderIds.indexOf(userId);
      if (order < 0) {
        uniqueOrderIds.push(userId);
        order = uniqueOrderIds.length - 1;
      }
      const color = USER_COLORS[order % USER_COLORS.length];

      const existing = yUsers.get(userId);
      if (existing) {
        const updated =
          existing.name !== userName || existing.order !== order || existing.color !== color
            ? { ...existing, name: userName, order, color }
            : existing;
        if (updated !== existing) {
          yUsers.set(userId, updated);
        }
        localUserRef.current = {
          id: userId,
          name: updated.name,
          color,
          order,
        };
      } else {
        const entry = {
          name: userName,
          color,
          order,
        };
        yUsers.set(userId, entry);
        localUserRef.current = {
          id: userId,
          name: entry.name,
          color,
          order,
        };
      }

      if (awarenessRef.current && localUserRef.current) {
        awarenessRef.current.setLocalStateField('user', {
          name: localUserRef.current.name,
          color: localUserRef.current.color,
        });
      }

      if (localUserRef.current && ydocRef.current) {
        const yNotes = ydocRef.current.getMap<StickyNote>('notes');
        yNotes.forEach((note, id) => {
          if (note.authorId === localUserRef.current?.id) {
            const nextColor = localUserRef.current.color;
            if (note.color !== nextColor || note.authorColor !== nextColor || note.authorName !== localUserRef.current.name) {
              yNotes.set(id, {
                ...note,
                color: nextColor,
                authorColor: nextColor,
                authorName: localUserRef.current.name,
              });
            }
          }
        });
      }
    };

    ensureLocalUser();

    provider.on('synced', ({ synced }: { synced: boolean }) => {
      if (!isActive) return;
      console.log(`[YJS] Synced: ${synced}`);
      if (synced) {
        ensureLocalUser();
      }
    });

    // Awareness change イベント復活
    awarenessRef.current.on('change', (changes: any) => {
      if (!isActive) return;
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
    const yNoteMeta = ydoc.getMap<NoteMeta>('notes_meta');
    const yImages = ydoc.getMap<BoardImage>('images');
    const yImageMeta = ydoc.getMap<ImageMeta>('images_meta');
    const yFiles = ydoc.getMap<BoardFile>('files');
    const yFileMeta = ydoc.getMap<FileMeta>('files_meta');

    const syncData = () => {
      setPaths(yPaths.toArray());
      const orderIds = yUserOrder.toArray();
      const orderMap = new Map<string, number>();
      orderIds.forEach((id) => {
        if (!orderMap.has(id)) {
          orderMap.set(id, orderMap.size);
        }
      });
      const noteEntries = Array.from(yNotes.entries());
      setNotes(
        noteEntries.map(([id, note]) => {
          const meta = yNoteMeta.get(id);
          const owner = note.authorId ? yUsers.get(note.authorId) : null;
          const derivedOrder =
            (note.authorId && orderMap.get(note.authorId)) ?? owner?.order;
          const resolvedColor =
            derivedOrder !== undefined
              ? USER_COLORS[derivedOrder % USER_COLORS.length]
              : owner?.color || note.authorColor || note.color;
          const resolvedName = owner?.name || note.authorName;
          const resolvedAuthorColor = resolvedColor;
          const base = {
            ...note,
            color: resolvedColor,
            authorColor: resolvedAuthorColor,
            authorName: resolvedName,
          };
          return meta ? { ...base, ...meta } : base;
        })
      );
      const imageEntries = Array.from(yImages.entries());
      setImages(
        imageEntries.map(([id, image]) => {
          const meta = yImageMeta.get(id);
          return meta ? { ...image, ...meta } : image;
        })
      );
      const fileEntries = Array.from(yFiles.entries());
      setFiles(
        fileEntries.map(([id, file]) => {
          const meta = yFileMeta.get(id);
          return meta ? { ...file, ...meta } : file;
        })
      );
    };

    syncData();

    yPaths.observe(syncData);
    yNotes.observe(syncData);
    yNoteMeta.observe(syncData);
    yUsers.observe(syncData);
    yUserOrder.observe(syncData);
    yImages.observe(syncData);
    yImageMeta.observe(syncData);
    yFiles.observe(syncData);
    yFileMeta.observe(syncData);

    authTimeout = setTimeout(() => {
      failAuthentication('接続に失敗しました。URLやパスワードを確認してください。');
    }, CONNECTION_TIMEOUT_MS);

    // WebSocket Connect
    provider.connect();

    return () => {
      isActive = false;
      if (authTimeout) clearTimeout(authTimeout);
      provider.off('status', handleStatus);
      provider.off('connection-error', handleConnectionError);
      provider.off('connection-close', handleConnectionClose);
      provider.destroy();
      ydoc.destroy();
    };
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
  const updatePaths = useCallback((updatedPaths: Path[]) => {
    const yPaths = ydocRef.current?.getArray<Path>('paths');
    if (!yPaths) return;
    const updateMap = new Map(updatedPaths.map((path) => [path.id, path]));
    ydocRef.current?.transact(() => {
      const current = yPaths.toArray() as Path[];
      current.forEach((path, index) => {
        const next = updateMap.get(path.id);
        if (next) {
          yPaths.delete(index, 1);
          yPaths.insert(index, [next]);
        }
      });
    });
  }, []);

  const clearBoard = useCallback(() => {
    ydocRef.current?.transact(() => {
      const p = ydocRef.current?.getArray<Path>('paths');
      if (p) p.delete(0, p.length);

      ydocRef.current?.getMap('notes').clear();
      ydocRef.current?.getMap('notes_meta').clear();
      ydocRef.current?.getMap('images').clear();
      ydocRef.current?.getMap('images_meta').clear();
      ydocRef.current?.getMap('files').clear();
      ydocRef.current?.getMap('files_meta').clear();
    });
  }, []);

  const addNote = useCallback(
    (note: StickyNote) => {
      const ydoc = ydocRef.current;
      if (!ydoc) return;
      const localUser = localUserRef.current;
      const localUserId = localUser?.id || localUserIdRef.current || note.authorId;
      const fallbackColor = note.color || USER_COLORS[0];
      const nextNote: StickyNote = {
        ...note,
        color: localUser?.color || fallbackColor,
        authorId: localUserId,
        authorName: localUser?.name || note.authorName || userName,
        authorColor: localUser?.color || note.authorColor || fallbackColor,
      };
      ydoc.getMap<StickyNote>('notes').set(note.id, nextNote);
      ydoc.getMap<NoteMeta>('notes_meta').set(note.id, {
        id: note.id,
        x: note.x,
        y: note.y,
        width: note.width,
        height: note.height,
      });
    },
    [userName]
  );

  const updateNote = useCallback(
    (note: StickyNote) => {
      const ydoc = ydocRef.current;
      if (!ydoc) return;
      const yNotes = ydoc.getMap<StickyNote>('notes');
      const yNoteMeta = ydoc.getMap<NoteMeta>('notes_meta');
      const existing = yNotes.get(note.id);
      const existingMeta = yNoteMeta.get(note.id);
      const nextMeta = {
        id: note.id,
        x: note.x,
        y: note.y,
        width: note.width,
        height: note.height,
      };

      if (
        !existingMeta ||
        existingMeta.x !== nextMeta.x ||
        existingMeta.y !== nextMeta.y ||
        existingMeta.width !== nextMeta.width ||
        existingMeta.height !== nextMeta.height
      ) {
        yNoteMeta.set(note.id, nextMeta);
      }

      if (!existing) {
        yNotes.set(note.id, note);
      } else if (
        existing.text !== note.text ||
        existing.color !== note.color
      ) {
        yNotes.set(note.id, {
          ...existing,
          text: note.text,
          color: existing.color || note.color,
          authorId: existing.authorId || note.authorId,
          authorName: existing.authorName || note.authorName,
          authorColor: existing.authorColor || note.authorColor,
        });
      }
    },
    []
  );

  const deleteNote = useCallback((id: string) => {
    ydocRef.current?.getMap('notes').delete(id);
    ydocRef.current?.getMap('notes_meta').delete(id);
  }, []);

  const addImage = useCallback(
    (img: BoardImage) => {
      const ydoc = ydocRef.current;
      if (!ydoc) return;
      ydoc.getMap<BoardImage>('images').set(img.id, img);
      ydoc.getMap<ImageMeta>('images_meta').set(img.id, {
        id: img.id,
        x: img.x,
        y: img.y,
        width: img.width,
        height: img.height,
      });
    },
    []
  );

  const updateImage = useCallback(
    (img: BoardImage) => {
      const ydoc = ydocRef.current;
      if (!ydoc) return;
      const yImages = ydoc.getMap<BoardImage>('images');
      const yImageMeta = ydoc.getMap<ImageMeta>('images_meta');
      const existing = yImages.get(img.id);
      const existingMeta = yImageMeta.get(img.id);
      const nextMeta = {
        id: img.id,
        x: img.x,
        y: img.y,
        width: img.width,
        height: img.height,
      };

      if (
        !existingMeta ||
        existingMeta.x !== nextMeta.x ||
        existingMeta.y !== nextMeta.y ||
        existingMeta.width !== nextMeta.width ||
        existingMeta.height !== nextMeta.height
      ) {
        yImageMeta.set(img.id, nextMeta);
      }

      if (!existing) {
        yImages.set(img.id, img);
      }
    },
    []
  );

  const deleteImage = useCallback((id: string) => {
    ydocRef.current?.getMap('images').delete(id);
    ydocRef.current?.getMap('images_meta').delete(id);
  }, []);

  const addFile = useCallback(
    (file: BoardFile) => {
      const ydoc = ydocRef.current;
      if (!ydoc) return;
      ydoc.getMap<BoardFile>('files').set(file.id, file);
      ydoc.getMap<FileMeta>('files_meta').set(file.id, {
        id: file.id,
        x: file.x,
        y: file.y,
        width: file.width,
        height: file.height,
      });
    },
    []
  );

  const updateFile = useCallback(
    (file: BoardFile) => {
      const ydoc = ydocRef.current;
      if (!ydoc) return;
      const yFileMeta = ydoc.getMap<FileMeta>('files_meta');
      const existingMeta = yFileMeta.get(file.id);
      const nextMeta = {
        id: file.id,
        x: file.x,
        y: file.y,
        width: file.width,
        height: file.height,
      };

      if (
        !existingMeta ||
        existingMeta.x !== nextMeta.x ||
        existingMeta.y !== nextMeta.y ||
        existingMeta.width !== nextMeta.width ||
        existingMeta.height !== nextMeta.height
      ) {
        yFileMeta.set(file.id, nextMeta);
      }
    },
    []
  );

  const deleteFile = useCallback((id: string) => {
    ydocRef.current?.getMap('files').delete(id);
    ydocRef.current?.getMap('files_meta').delete(id);
  }, []);

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
    updatePaths,
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
