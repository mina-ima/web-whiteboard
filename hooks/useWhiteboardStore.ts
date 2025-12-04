import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { Path, StickyNote, BoardImage, BoardFile, UserAwareness } from '../types';

// Use a single reliable server to prevent Split Brain
const SIGNALING_SERVERS = [
  'wss://signaling.yjs.dev',
  'wss://y-webrtc-signaling-eu.herokuapp.com',
  'wss://y-webrtc-signaling-us.herokuapp.com'
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

    const internalRoomName = `gemini-sb-v13-${roomId}`;
    console.log(`[YJS-SETUP] Creating new provider for room: ${internalRoomName}`);

    const provider = new WebrtcProvider(internalRoomName, ydoc, {
      signaling: SIGNALING_SERVERS,
      password: passcode || null,
      maxConns: 20 + Math.floor(Math.random() * 5),
      filterBcConns: false,
      peerOpts: {
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:global.stun.twilio.com:3478" },
              { urls: "stun:stun1.l.google.com:19302" },
              { urls: "stun:stun2.l.google.com:19302" },
              { urls: "stun:stun.services.mozilla.com" },
              { urls: "stun:stun.xten.com" }
            ]
          }
      }
    });
    providerRef.current = provider;
    awarenessRef.current = provider.awareness;

    // --- Event Listeners for Debugging ---
    provider.on('status', ({ status }: { status: string }) => {
      console.log(`[YJS-EVENT] Status: ${status}`);
      setIsConnected(status === 'connected');
    });

    provider.on('synced', ({ synced }: { synced: boolean }) => {
        console.log(`[YJS-EVENT] Synced: ${synced}`);
    });

    provider.on('peers', (event: any) => {
       console.log(`[YJS-EVENT] Peers changed: added=${event.added.length}, removed=${event.removed.length}, conns=${event.webrtcConns.size}`);
       setPeers(Array.from(event.webrtcConns.keys()));
    });
    
    awarenessRef.current.on('change', (changes: any) => {
        console.log(`[YJS-AWARENESS] Change: added=${changes.added.length}, updated=${changes.updated.length}, removed=${changes.removed.length}`);
        const states = Array.from(awarenessRef.current.getStates().entries());
        const users = states
            .filter(([clientId, state]: [number, any]) => clientId !== ydoc.clientID && state.user)
            .map(([clientId, state]: [number, any]) => ({ clientId, user: state.user, cursor: state.cursor }));
        setRemoteUsers(users);
    });

    // --- Data Sync Setup ---
    const yPaths = ydoc.getArray('paths');
    const yNotes = ydoc.getMap('notes');
    const yImages = ydoc.getMap('images');
    const yFiles = ydoc.getMap('files');

    const syncData = () => {
        setPaths(yPaths.toArray());
        setNotes(Array.from(yNotes.values()));
        setImages(Array.from(yImages.values()));
        setFiles(Array.from(yFiles.values()));
    };
    syncData(); // Initial sync
    yPaths.observe(syncData);
    yNotes.observe(syncData);
    yImages.observe(syncData);
    yFiles.observe(syncData);

    // --- Authentication Logic ---
    let authTimeoutId: NodeJS.Timeout | null = null;
    const awareness = provider.awareness;

    const cleanupAuth = () => {
      if (authTimeoutId) {
        console.log('[Auth] Clearing authentication timeout.');
        clearTimeout(authTimeoutId);
        authTimeoutId = null;
      }
      awareness.off('update', awarenessUpdateHandler);
    };

    const awarenessUpdateHandler = (changes: any) => {
      const awarenessCount = awareness.getStates().size;
      console.log(`[Auth] Awareness update received. Total states: ${awarenessCount}. Changes:`, changes);
      if (awarenessCount > 1) {
        console.log("[Auth] SUCCESS: Decrypted peer awareness. Authentication successful.");
        cleanupAuth();
        setIsAuthenticating(false);
      }
    };

    awareness.setLocalState({ user: { name: userName, color: USER_COLORS[ydoc.clientID % USER_COLORS.length] }, cursor: null });

    if (!isCreator && passcode) {
      console.log("[Auth] Starting password authentication process for joiner.");
      awareness.on('update', awarenessUpdateHandler);
      
      authTimeoutId = setTimeout(() => {
        const peerCount = providerRef.current?.webrtcConns.size || 0;
        const awarenessCount = awareness.getStates().size;
        console.log(`[Auth] TIMEOUT CHECK: Peer connections=${peerCount}, Decrypted awareness states=${awarenessCount}`);

        if (peerCount > 0 && awarenessCount <= 1) {
          console.warn("[Auth] FAILURE: Peers are present, but awareness could not be decrypted. Setting connection error.");
          setConnectionError("Authentication failed: Incorrect password.");
        } else {
          console.log("[Auth] SUCCESS (by timeout): No peers to verify against, or already verified. Assuming success.");
        }
        
        cleanupAuth();
        setIsAuthenticating(false);
      }, 10000); // Extended to 10 seconds

    } else {
      console.log("[Auth] No authentication needed (is creator or no password).");
      setIsAuthenticating(false);
    }

    return () => {
      console.log(`[YJS-EFFECT] Cleanup: room=${roomId}`);
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