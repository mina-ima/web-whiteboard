import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { Path, StickyNote, BoardImage, BoardFile } from '../types';

// Use a list of public signaling servers for better reliability
const SIGNALING_SERVERS = [
  'wss://signaling.yjs.dev',
  'wss://y-webrtc-signaling-eu.herokuapp.com',
  'wss://y-webrtc-signaling-us.herokuapp.com'
];

export const useWhiteboardStore = (roomId: string | null, passcode: string | null, userName: string) => {
  const [paths, setPaths] = useState<Path[]>([]);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [images, setImages] = useState<BoardImage[]>([]);
  const [files, setFiles] = useState<BoardFile[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);

  useEffect(() => {
    if (!roomId || !passcode) return;

    console.log(`[YJS] Connecting to room: gemini-board-${roomId}`);

    // Initialize Yjs Document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Initialize WebRTC Provider (P2P Sync)
    const provider = new WebrtcProvider(`gemini-board-${roomId}`, ydoc, {
      password: passcode,
      signaling: SIGNALING_SERVERS,
      maxConns: 20 + Math.floor(Math.random() * 15), // Randomize max connections slightly
      filterBcConns: false, // Ensure cross-tab communication works reliably
    });
    providerRef.current = provider;

    provider.on('status', (event: { status: string }) => {
      console.log(`[YJS] Connection status: ${event.status}`);
      setIsConnected(event.status === 'connected');
    });

    provider.on('synced', (event: { synced: boolean }) => {
        console.log(`[YJS] Synced: ${event.synced}`);
    });

    // Define Yjs Types
    const yPaths = ydoc.getArray<Path>('paths');
    const yNotes = ydoc.getMap<StickyNote>('notes');
    const yImages = ydoc.getMap<BoardImage>('images');
    const yFiles = ydoc.getMap<BoardFile>('files');

    // Sync Initial State to React
    setPaths(yPaths.toArray());
    setNotes(Array.from(yNotes.values()));
    setImages(Array.from(yImages.values()));
    setFiles(Array.from(yFiles.values()));

    // Observer Changes
    yPaths.observe(() => {
      // console.log('[YJS] Paths updated');
      setPaths(yPaths.toArray());
    });
    yNotes.observe(() => {
      // console.log('[YJS] Notes updated');
      setNotes(Array.from(yNotes.values()));
    });
    yImages.observe(() => {
      // console.log('[YJS] Images updated');
      setImages(Array.from(yImages.values()));
    });
    yFiles.observe(() => {
      // console.log('[YJS] Files updated');
      setFiles(Array.from(yFiles.values()));
    });

    return () => {
      console.log('[YJS] Disconnecting...');
      provider.destroy();
      ydoc.destroy();
    };
  }, [roomId, passcode]);

  // --- Mutation Helpers ---

  const addPath = useCallback((path: Path) => {
    ydocRef.current?.getArray<Path>('paths').push([path]);
  }, []);

  const deletePaths = useCallback((pathIds: string[]) => {
    const yPaths = ydocRef.current?.getArray<Path>('paths');
    if (!yPaths) return;
    
    ydocRef.current?.transact(() => {
      const current = yPaths.toArray();
      const indexesToDelete: number[] = [];
      
      current.forEach((p, i) => {
        if (pathIds.includes(p.id)) {
          indexesToDelete.push(i);
        }
      });

      // Delete in reverse order to preserve indexes
      indexesToDelete.sort((a, b) => b - a).forEach(i => {
        yPaths.delete(i, 1);
      });
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

  // Generic helpers for Map-based items (Notes, Images, Files)
  
  const addNote = useCallback((note: StickyNote) => {
    ydocRef.current?.getMap<StickyNote>('notes').set(note.id, note);
  }, []);

  const updateNote = useCallback((note: StickyNote) => {
    ydocRef.current?.getMap<StickyNote>('notes').set(note.id, note);
  }, []);

  const deleteNote = useCallback((id: string) => {
    ydocRef.current?.getMap<StickyNote>('notes').delete(id);
  }, []);

  const addImage = useCallback((img: BoardImage) => {
    ydocRef.current?.getMap<BoardImage>('images').set(img.id, img);
  }, []);

  const updateImage = useCallback((img: BoardImage) => {
    ydocRef.current?.getMap<BoardImage>('images').set(img.id, img);
  }, []);

  const deleteImage = useCallback((id: string) => {
    ydocRef.current?.getMap<BoardImage>('images').delete(id);
  }, []);

  const addFile = useCallback((file: BoardFile) => {
    ydocRef.current?.getMap<BoardFile>('files').set(file.id, file);
  }, []);

  const updateFile = useCallback((file: BoardFile) => {
    ydocRef.current?.getMap<BoardFile>('files').set(file.id, file);
  }, []);

  const deleteFile = useCallback((id: string) => {
    ydocRef.current?.getMap<BoardFile>('files').delete(id);
  }, []);

  return {
    paths,
    notes,
    images,
    files,
    isConnected,
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