import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { Path, StickyNote, BoardImage, BoardFile, UserAwareness } from '../types';

// Use a single reliable server to prevent Split Brain
const SIGNALING_SERVERS = [
  'wss://signaling.yjs.dev'
];

const USER_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];

export const useWhiteboardStore = (roomId: string | null, passcode: string | null, userName: string, isCreator: boolean) => {
  const [paths, setPaths] = useState<Path[]>([]);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [images, setImages] = useState<BoardImage[]>([]);
  const [files, setFiles] = useState<BoardFile[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState<string[]>([]);
  const [remoteUsers, setRemoteUsers] = useState<UserAwareness[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const awarenessRef = useRef<any>(null);

  useEffect(() => {
    if (!roomId) return;

    // Reset error
    setConnectionError(null);
    setIsConnected(false);

    // Cleanup previous
    if (providerRef.current) {
      providerRef.current.destroy();
      ydocRef.current?.destroy();
    }

    // Use a clean room ID namespace
    const internalRoomName = `gemini-sb-v13-${roomId}`;
    console.log(`[YJS] Connecting to room: ${internalRoomName}, isCreator: ${isCreator}`);

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new WebrtcProvider(internalRoomName, ydoc, {
      signaling: SIGNALING_SERVERS,
      password: passcode || null, // If passcode is provided, it encrypts the room
      maxConns: 20 + Math.floor(Math.random() * 5),
      filterBcConns: false, 
      peerOpts: {
        poly: false,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      } as any 
    });
    providerRef.current = provider;
    awarenessRef.current = provider.awareness;

    // --- Connection Status ---
    provider.on('status', (event: any) => {
      console.log(`[YJS] Connection status: ${event.status}`);
      setIsConnected(event.connected || event.status === 'connected');
    });

    provider.on('peers', (event: any) => {
       const connectedPeers = Array.from(event.webrtcConns.keys()) as string[];
       console.log('[YJS] Peers updated:', connectedPeers.length, connectedPeers);
       setPeers(connectedPeers);
    });

    // --- Awareness & Password Check ---
    const userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    
    const setLocalState = () => {
        provider.awareness.setLocalState({
          user: {
            name: userName,
            color: userColor
          },
          cursor: null
        });
    };
    setLocalState();

    provider.awareness.on('change', () => {
      const states = Array.from(provider.awareness.getStates().entries()) as [number, any][];
      const users: UserAwareness[] = states
        .filter(([clientId, state]) => clientId !== ydoc.clientID && state.user)
        .map(([clientId, state]) => ({
          clientId,
          user: state.user,
          cursor: state.cursor
        }));
      setRemoteUsers(users);
    });

    // --- Data Sync ---
    // Note: removed generic types <Path> etc to avoid TS errors in strict mode
    const yPaths = ydoc.getArray('paths');
    const yNotes = ydoc.getMap('notes');
    const yImages = ydoc.getMap('images');
    const yFiles = ydoc.getMap('files');

    setPaths(yPaths.toArray() as Path[]);
    setNotes(Array.from(yNotes.values()) as StickyNote[]);
    setImages(Array.from(yImages.values()) as BoardImage[]);
    setFiles(Array.from(yFiles.values()) as BoardFile[]);

    yPaths.observe(() => setPaths(yPaths.toArray() as Path[]));
    yNotes.observe(() => setNotes(Array.from(yNotes.values()) as StickyNote[]));
    yImages.observe(() => setImages(Array.from(yImages.values()) as BoardImage[]));
    yFiles.observe(() => setFiles(Array.from(yFiles.values()) as BoardFile[]));

    // --- Heuristic Password Check ---
    let checkInterval: any = null;
    let timeoutId: any = null;

    // For participants in a password-protected room, set a timeout.
    // If no peers are found within this time, assume the room is non-existent or the password is wrong.
    if (!isCreator && passcode) {
        timeoutId = setTimeout(() => {
            const currentPeers = (providerRef.current?.room as any)?.webrtcConns?.size || 0;
            if (currentPeers === 0) {
                console.warn(`[Security] Timed out waiting for peers. Room is password-protected. Assuming wrong password or non-existent room.`);
                setConnectionError("Authentication timed out. The room may not exist, or the password may be incorrect.");
                if (checkInterval) clearInterval(checkInterval);
            }
        }, 7000); // 7-second timeout
    }

    checkInterval = setInterval(() => {
        if (!providerRef.current) {
            clearInterval(checkInterval);
            return;
        }
        
        // This check is for when there are peers, but we can't decrypt their data.
        if (passcode) {
          const hasPeers = (providerRef.current.room as any)?.webrtcConns?.size > 0;
          const awarenessStates = providerRef.current.awareness.getStates();
          const hasDecryptedAwareness = awarenessStates.size > 1; // More than just our own awareness state
          
          if (hasPeers && !hasDecryptedAwareness) {
              console.warn("[Security] Peers detected but could not decrypt awareness. Passwords likely do not match.");
              setConnectionError("Incorrect password. Unable to decrypt room data.");
              if (timeoutId) clearTimeout(timeoutId);
              clearInterval(checkInterval);
          }
        }
    }, 2000); 

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (timeoutId) clearTimeout(timeoutId);
      provider.destroy();
      ydoc.destroy();
    };
  }, [roomId, passcode, userName, isCreator]); 

  // Cursor Helper
  const updateCursor = useCallback((point: {x: number, y: number} | null) => {
    if (awarenessRef.current) {
        awarenessRef.current.setLocalStateField('cursor', point);
    }
  }, []);

  // Mutation Helpers
  const addPath = useCallback((path: Path) => ydocRef.current?.getArray('paths').push([path]), []);
  const deletePaths = useCallback((pathIds: string[]) => {
    const yPaths = ydocRef.current?.getArray('paths');
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
      const p = ydocRef.current?.getArray('paths');
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
    paths, notes, images, files, isConnected, peers, remoteUsers, connectionError,
    updateCursor, addPath, deletePaths, clearBoard,
    addNote, updateNote, deleteNote, addImage, updateImage, deleteImage, addFile, updateFile, deleteFile
  };
};