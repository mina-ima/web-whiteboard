import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { Path, StickyNote, BoardImage, BoardFile, UserAwareness } from '../types';

// Multiple signaling servers to ensure connectivity
const SIGNALING_SERVERS = [
  'wss://signaling.yjs.dev',
  'wss://y-webrtc-signaling-eu.herokuapp.com',
  'wss://y-webrtc-signaling-us.herokuapp.com'
];

const USER_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'];

export const useWhiteboardStore = (roomId: string | null, passcode: string | null, userName: string) => {
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

    // Cleanup previous
    if (providerRef.current) {
      providerRef.current.destroy();
      ydocRef.current?.destroy();
    }

    const internalRoomName = `gemini-sb-v10-${roomId}`;
    console.log(`[YJS] Connecting to room: ${internalRoomName}`);

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new WebrtcProvider(internalRoomName, ydoc, {
      signaling: SIGNALING_SERVERS,
      password: passcode || null,
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
    const yPaths = ydoc.getArray<Path>('paths');
    const yNotes = ydoc.getMap<StickyNote>('notes');
    const yImages = ydoc.getMap<BoardImage>('images');
    const yFiles = ydoc.getMap<BoardFile>('files');

    setPaths(yPaths.toArray());
    setNotes(Array.from(yNotes.values()));
    setImages(Array.from(yImages.values()));
    setFiles(Array.from(yFiles.values()));

    yPaths.observe(() => setPaths(yPaths.toArray()));
    yNotes.observe(() => setNotes(Array.from(yNotes.values())));
    yImages.observe(() => setImages(Array.from(yImages.values())));
    yFiles.observe(() => setFiles(Array.from(yFiles.values())));

    // --- Heuristic Password Check ---
    // If we have connected peers but cannot decrypt their awareness (remoteUsers remains empty)
    // it likely means the password is wrong.
    const checkInterval = setInterval(() => {
        const hasPeers = provider.room && (provider.room as any).peers.size > 0;
        const hasAwareness = provider.awareness.getStates().size > 1; // 1 is self
        
        // If we are connected to peers for a while but see no one (and we are not the creator alone)
        // This is a guess. If users enter a populated room with wrong password.
        if (hasPeers && !hasAwareness) {
            // We give it some time, but if this persists, it's likely a password error.
            // However, distinguishing "Empty Room" from "Wrong Password" is hard if we are alone.
            // But if 'peers' (WebRTC connections) exist, we are NOT alone.
            // So Peers > 0 AND Awareness == 1 means encryption failed.
            console.warn("Peers detected but no awareness data. Likely wrong password.");
            setConnectionError("Incorrect password. Unable to join secure session.");
        }
    }, 4000); 

    return () => {
      clearInterval(checkInterval);
      provider.destroy();
      ydoc.destroy();
    };
  }, [roomId, passcode, userName]); 

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
      const current = yPaths.toArray();
      const indexesToDelete: number[] = [];
      current.forEach((p, i) => { if (pathIds.includes(p.id)) indexesToDelete.push(i); });
      indexesToDelete.sort((a, b) => b - a).forEach(i => yPaths.delete(i, 1));
    });
  }, []);

  const clearBoard = useCallback(() => {
    ydocRef.current?.transact(() => {
      ydocRef.current?.getArray('paths').delete(0, ydocRef.current?.getArray('paths').length);
      ydocRef.current?.getMap('notes').clear();
      ydocRef.current?.getMap('images').clear();
      ydocRef.current?.getMap('files').clear();
    });
  }, []);

  const addNote = useCallback((note: StickyNote) => ydocRef.current?.getMap<StickyNote>('notes').set(note.id, note), []);
  const updateNote = useCallback((note: StickyNote) => ydocRef.current?.getMap<StickyNote>('notes').set(note.id, note), []);
  const deleteNote = useCallback((id: string) => ydocRef.current?.getMap<StickyNote>('notes').delete(id), []);

  const addImage = useCallback((img: BoardImage) => ydocRef.current?.getMap<BoardImage>('images').set(img.id, img), []);
  const updateImage = useCallback((img: BoardImage) => ydocRef.current?.getMap<BoardImage>('images').set(img.id, img), []);
  const deleteImage = useCallback((id: string) => ydocRef.current?.getMap<BoardImage>('images').delete(id), []);

  const addFile = useCallback((file: BoardFile) => ydocRef.current?.getMap<BoardFile>('files').set(file.id, file), []);
  const updateFile = useCallback((file: BoardFile) => ydocRef.current?.getMap<BoardFile>('files').set(file.id, file), []);
  const deleteFile = useCallback((id: string) => ydocRef.current?.getMap<BoardFile>('files').delete(id), []);

  return {
    paths, notes, images, files, isConnected, peers, remoteUsers, connectionError,
    updateCursor, addPath, deletePaths, clearBoard,
    addNote, updateNote, deleteNote, addImage, updateImage, deleteImage, addFile, updateFile, deleteFile
  };
};