import { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { Path, StickyNote, BoardImage, BoardFile } from '../types';

// Use a known public signaling server for demo purposes
// In production, you would host your own signaling server
const SIGNALING_SERVERS = ['wss://signaling.yjs.dev'];

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

    // Initialize Yjs Document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Initialize WebRTC Provider (P2P Sync)
    // We use the roomId + passcode to create a unique room, 
    // and use the password option to encrypt communication
    const provider = new WebrtcProvider(`gemini-board-${roomId}`, ydoc, {
      password: passcode,
      signaling: SIGNALING_SERVERS,
    });
    providerRef.current = provider;

    provider.on('status', (event: { status: string }) => {
      setIsConnected(event.status === 'connected');
    });

    // Define Yjs Types
    // We use Y.Array for paths to maintain drawing order
    const yPaths = ydoc.getArray<Path>('paths');
    // We use Y.Map for items to easily update by ID without scanning arrays
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
      setPaths(yPaths.toArray());
    });
    yNotes.observe(() => {
      setNotes(Array.from(yNotes.values()));
    });
    yImages.observe(() => {
      setImages(Array.from(yImages.values()));
    });
    yFiles.observe(() => {
      setFiles(Array.from(yFiles.values()));
    });

    return () => {
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
    
    // Y.Array deletion is index based, which is tricky for concurrent edits.
    // A simplified approach for this demo:
    // We rebuild the array without the deleted items.
    // In a production app, we might use Y.Map for paths too or careful index handling.
    
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