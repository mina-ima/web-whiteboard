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
  const [isAuthenticating, setIsAuthenticating] = useState(true);

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
    let authTimeoutId: NodeJS.Timeout | null = null;
    const awareness = provider.awareness; // Use a local const for easier access

    // Start in an authenticating state by default.
    setIsAuthenticating(true);

    const cleanupAuth = () => {
      if (authTimeoutId) clearTimeout(authTimeoutId);
      awareness.off('update', awarenessUpdateHandler);
    };

    const awarenessUpdateHandler = () => {
      // If we can decrypt more than just our own state, the password is correct.
      if (awareness.getStates().size > 1) {
        console.log("[Security] Peer awareness decrypted. Clearing auth timeout.");
        cleanupAuth();
        setIsAuthenticating(false); // Auth complete
      }
    };

    // For participants joining a password-protected room, set a timeout.
    // If we can't decrypt any other user's awareness within this time,
    // assume the room is non-existent or the password is wrong.
    if (!isCreator && passcode) {
      console.log("[Security] Joining protected room. Setting auth timeout.");

      awareness.on('update', awarenessUpdateHandler);

      authTimeoutId = setTimeout(() => {
        const peerCount = providerRef.current?.webrtcConns.size || 0;
        const awarenessCount = awareness.getStates().size;

        console.log(`[Security] Auth timeout check. Peers: ${peerCount}, Awareness States: ${awarenessCount}`);

        // If there are peers but we couldn't decrypt any awareness, it's a failure.
        if (peerCount > 0 && awarenessCount <= 1) {
          console.warn(`[Security] Auth failed: Peers are present, but awareness could not be decrypted.`);
          setConnectionError("Authentication failed: Incorrect password.");
        } else {
          // Otherwise (no peers, or awareness was decrypted), we consider it a success for now.
          console.log(`[Security] Auth considered successful (case: empty room or already decrypted).`);
        }
        
        cleanupAuth();
        setIsAuthenticating(false); // Auth process is over, regardless of outcome
      }, 7000); // 7-second timeout
    } else {
      // If not a joiner with password, we are instantly "authenticated".
      setIsAuthenticating(false);
    }

    return () => {
      cleanupAuth();
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
    paths, notes, images, files, isConnected, peers, remoteUsers, connectionError, isAuthenticating,
    updateCursor, addPath, deletePaths, clearBoard,
    addNote, updateNote, deleteNote, addImage, updateImage, deleteImage, addFile, updateFile, deleteFile
  };
};