import React, { useRef, useEffect, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Path, Point, ToolType, StickyNote, BoardImage, BoardFile, UserAwareness } from '../types';
import { 
  XMarkIcon, 
  ArrowsPointingOutIcon, 
  DocumentIcon, 
  TableCellsIcon, 
  DocumentTextIcon, 
  PresentationChartBarIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';

interface WhiteboardProps {
  tool: ToolType;
  paths: Path[];
  notes: StickyNote[];
  images: BoardImage[];
  files: BoardFile[];
  remoteUsers: UserAwareness[];
  
  // Sync Handlers
  onPathAdd: (path: Path) => void;
  onPathsDelete: (ids: string[]) => void;
  
  onNoteAdd: (note: StickyNote) => void;
  onNoteUpdate: (note: StickyNote) => void;
  onNoteDelete: (id: string) => void;

  onImageUpdate: (image: BoardImage) => void;
  onImageDelete: (id: string) => void;

  onFileUpdate: (file: BoardFile) => void;
  onFileDelete: (id: string) => void;

  onCursorMove: (point: Point | null) => void;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({ 
  tool, paths, notes, images, files, remoteUsers,
  onPathAdd, onPathsDelete,
  onNoteAdd, onNoteUpdate, onNoteDelete,
  onImageUpdate, onImageDelete,
  onFileUpdate, onFileDelete,
  onCursorMove
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Drawing State (Refs for performance)
  const isDrawingRef = useRef(false);
  const currentPathPointsRef = useRef<Point[]>([]);
  
  // Interaction State
  const [dragItem, setDragItem] = useState<{ type: 'note' | 'image' | 'file', id: string, offsetX: number, offsetY: number } | null>(null);
  const [resizeItem, setResizeItem] = useState<{ type: 'note' | 'image' | 'file', id: string, startX: number, startY: number, startWidth: number, startHeight: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number, h: number } | null>(null);

  // Helper to determine if we should be writing ON TOP of everything
  const isPenOrEraser = tool === ToolType.PEN || tool === ToolType.ERASER;

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        setCanvasSize({ 
            w: rect.width * dpr, 
            h: rect.height * dpr 
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Main Render Loop
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasSize) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset transform to clear full buffer
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scale for High DPI
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Draw existing paths (Committed)
    paths.forEach(path => {
      if (path.points.length < 1) return;
      ctx.beginPath();
      ctx.lineWidth = path.width;
      ctx.strokeStyle = path.color;
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });

    // 2. Draw current path (Being drawn) - from REF
    const currentPoints = currentPathPointsRef.current;
    if (currentPoints.length > 0) {
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1e293b';
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      for (let i = 1; i < currentPoints.length; i++) {
        ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
      }
      ctx.stroke();
    }
  }, [paths, canvasSize]);

  // Animation Loop
  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      renderCanvas();
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [renderCanvas]);

  // Sync Canvas Size
  useEffect(() => {
    if (canvasRef.current && canvasSize && containerRef.current) {
        canvasRef.current.width = canvasSize.w;
        canvasRef.current.height = canvasSize.h;
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.style.width = `${rect.width}px`;
        canvasRef.current.style.height = `${rect.height}px`;
    }
  }, [canvasSize]);

  const distToSegment = (p: Point, v: Point, w: Point) => {
     const dist2 = (v: Point, w: Point) => (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
     const l2 = dist2(v, w);
     if (l2 === 0) return Math.sqrt(dist2(p, v));
     let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
     t = Math.max(0, Math.min(1, t));
     const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
     return Math.sqrt(dist2(p, proj));
  };

  const eraseAt = (pos: Point) => {
    const ERASER_RADIUS = 20; 

    // Find paths intersecting eraser
    const pathsToDelete = paths.filter(path => {
      for (let i = 0; i < path.points.length - 1; i++) {
        if (distToSegment(pos, path.points[i], path.points[i + 1]) < ERASER_RADIUS) {
          return true; 
        }
      }
      return false;
    }).map(p => p.id);

    if (pathsToDelete.length > 0) {
      onPathsDelete(pathsToDelete);
    }

    // Check items
    notes.forEach(note => {
      if (pos.x >= note.x && pos.x <= note.x + note.width && pos.y >= note.y && pos.y <= note.y + note.height) {
        onNoteDelete(note.id);
      }
    });
    images.forEach(img => {
      if (pos.x >= img.x && pos.x <= img.x + img.width && pos.y >= img.y && pos.y <= img.y + (img.height || 200)) {
        onImageDelete(img.id);
      }
    });
    files.forEach(f => {
      if (pos.x >= f.x && pos.x <= f.x + f.width && pos.y >= f.y && pos.y <= f.y + f.height) {
        onFileDelete(f.id);
      }
    });
  };

  const getPos = (e: React.PointerEvent): Point => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // ------------------------------------------
  // Interactions
  // ------------------------------------------

  const handlePointerDown = (e: React.PointerEvent) => {
    const pos = getPos(e);

    // If using Pen/Eraser, we want to capture on the container immediately
    if (tool === ToolType.PEN || tool === ToolType.ERASER) {
       if (containerRef.current) {
         containerRef.current.setPointerCapture(e.pointerId);
       }
    }

    if (tool === ToolType.ERASER) {
      eraseAt(pos);
      isDrawingRef.current = true;
    } else if (tool === ToolType.PEN) {
      isDrawingRef.current = true;
      currentPathPointsRef.current = [pos];
    } else if (tool === ToolType.NOTE) {
      // Add note
      const newNote: StickyNote = {
        id: uuidv4(),
        x: pos.x - 75,
        y: pos.y - 75,
        text: '',
        color: '#fef3c7', 
        width: 200,
        height: 200
      };
      onNoteAdd(newNote);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Prevent default touch actions like scrolling
    e.preventDefault();
    const pos = getPos(e);
    
    // 1. Broadcast Cursor
    onCursorMove(pos);

    // 2. Handle Resize
    if (resizeItem) {
        const dx = pos.x - resizeItem.startX;
        const dy = pos.y - resizeItem.startY;
        const newWidth = Math.max(50, resizeItem.startWidth + dx);
        const newHeight = Math.max(50, resizeItem.startHeight + dy);

        if (resizeItem.type === 'note') {
            const item = notes.find(n => n.id === resizeItem.id);
            if(item) onNoteUpdate({ ...item, width: newWidth, height: newHeight });
        } else if (resizeItem.type === 'image') {
            const item = images.find(i => i.id === resizeItem.id);
            if(item) onImageUpdate({ ...item, width: newWidth, height: newHeight });
        } else if (resizeItem.type === 'file') {
            const item = files.find(f => f.id === resizeItem.id);
            if(item) onFileUpdate({ ...item, width: newWidth, height: newHeight });
        }
        return;
    }

    // 3. Handle Drag
    if (tool === ToolType.SELECT && dragItem) {
      if (dragItem.type === 'note') {
        const item = notes.find(n => n.id === dragItem.id);
        if(item) onNoteUpdate({ ...item, x: pos.x - dragItem.offsetX, y: pos.y - dragItem.offsetY });
      } else if (dragItem.type === 'image') {
        const item = images.find(i => i.id === dragItem.id);
        if(item) onImageUpdate({ ...item, x: pos.x - dragItem.offsetX, y: pos.y - dragItem.offsetY });
      } else if (dragItem.type === 'file') {
        const item = files.find(f => f.id === dragItem.id);
        if(item) onFileUpdate({ ...item, x: pos.x - dragItem.offsetX, y: pos.y - dragItem.offsetY });
      }
      return;
    }

    // 4. Handle Eraser
    if (tool === ToolType.ERASER && isDrawingRef.current) {
      eraseAt(pos);
      return;
    }

    // 5. Handle Drawing (Pen)
    if (isDrawingRef.current && tool === ToolType.PEN) {
      // Coalesced events give higher precision for Pen inputs
      // Fix TS Error by casting to any or generic PointerEvent
      const nativeEvent = e.nativeEvent as any;
      const events = nativeEvent?.getCoalescedEvents ? nativeEvent.getCoalescedEvents() : [e];
      
      events.forEach((evt: any) => {
         const rect = containerRef.current!.getBoundingClientRect();
         const pt = {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
         };
         currentPathPointsRef.current.push(pt);
      });
      // No state update here! The Loop picks it up.
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (containerRef.current && (tool === ToolType.PEN || tool === ToolType.ERASER)) {
        containerRef.current.releasePointerCapture(e.pointerId);
    }

    if (dragItem) setDragItem(null);
    if (resizeItem) setResizeItem(null);

    if (isDrawingRef.current) {
        if (tool === ToolType.PEN && currentPathPointsRef.current.length > 0) {
            const newPath: Path = {
              id: uuidv4(),
              points: [...currentPathPointsRef.current], // Copy ref content
              color: '#1e293b',
              width: 3
            };
            onPathAdd(newPath);
        }
        
        currentPathPointsRef.current = [];
        isDrawingRef.current = false;
    }
  };

  const handleItemPointerDown = (e: React.PointerEvent, id: string, type: 'note' | 'image' | 'file') => {
    if (tool !== ToolType.SELECT) return;

    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const pos = getPos(e);
    let itemX = 0, itemY = 0;
    if (type === 'note') {
      const item = notes.find(n => n.id === id);
      if (item) { itemX = item.x; itemY = item.y; }
    } else if (type === 'image') {
      const item = images.find(i => i.id === id);
      if (item) { itemX = item.x; itemY = item.y; }
    } else {
      const item = files.find(f => f.id === id);
      if (item) { itemX = item.x; itemY = item.y; }
    }

    setDragItem({ type, id, offsetX: pos.x - itemX, offsetY: pos.y - itemY });
  };

  const handleResizePointerDown = (e: React.PointerEvent, id: string, type: 'note' | 'image' | 'file', w: number, h: number) => {
    if (tool !== ToolType.SELECT) return;
    e.stopPropagation();
    // Capture on container to allow dragging outside item bounds
    containerRef.current?.setPointerCapture(e.pointerId);

    const pos = getPos(e);
    setResizeItem({ type, id, startX: pos.x, startY: pos.y, startWidth: w, startHeight: h });
  };

  const updateNoteText = (id: string, text: string) => {
    const item = notes.find(n => n.id === id);
    if(item) onNoteUpdate({ ...item, text });
  };

  const deleteItem = (id: string, type: 'note' | 'image' | 'file') => {
    if (type === 'note') onNoteDelete(id);
    if (type === 'image') onImageDelete(id);
    if (type === 'file') onFileDelete(id);
  };

  const getFileIcon = (fileType: string) => {
     const type = fileType.toLowerCase();
     if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv') || type.includes('sheet')) {
        return <TableCellsIcon className="w-1/2 h-1/2 text-green-600" />;
     }
     if (type.includes('word') || type.includes('document') || type.includes('text')) {
        return <DocumentTextIcon className="w-1/2 h-1/2 text-blue-600" />;
     }
     if (type.includes('presentation') || type.includes('powerpoint')) {
        return <PresentationChartBarIcon className="w-1/2 h-1/2 text-orange-500" />;
     }
     return <DocumentIcon className="w-1/2 h-1/2 text-gray-500" />;
  };

  // When using PEN or ERASER, disable events on items so we can draw through them
  // AND ensure canvas is on top (z-50) via the canvas element style below
  const itemPointerEvents = isPenOrEraser ? 'pointer-events-none' : 'pointer-events-auto';

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-full overflow-hidden bg-slate-50 dot-grid ${tool === ToolType.PEN ? 'cursor-crosshair' : tool === ToolType.ERASER ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ touchAction: 'none', userSelect: 'none' }} 
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 
         CANVAS LAYERING:
         - Select Mode: z-10 (Behind items, items are z-20)
         - Pen/Eraser Mode: z-50 (On top of items to capture strokes)
      */}
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full touch-none"
        style={{ zIndex: isPenOrEraser ? 50 : 10 }}
      />

      {/* Files (z-15) */}
      {files.map(file => (
        <div
            key={file.id}
            className={`absolute border border-gray-200 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow group touch-none flex flex-col items-center justify-center p-2 ${itemPointerEvents}`}
            style={{ left: file.x, top: file.y, width: file.width, height: file.height, zIndex: 15 }}
            onPointerDown={(e) => handleItemPointerDown(e, file.id, 'file')}
        >
             {tool === ToolType.SELECT && (
              <button 
                onPointerDown={(e) => { e.stopPropagation(); deleteItem(file.id, 'file'); }}
                className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 shadow-sm z-20 pointer-events-auto hover:bg-red-600"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
             )}

            <div className="flex-1 w-full flex items-center justify-center bg-gray-50 rounded mb-2">
                {getFileIcon(file.fileType)}
            </div>
            
            <div className="w-full flex items-center justify-between text-xs px-1">
                <span className="truncate font-medium text-gray-700 max-w-[80%]">{file.fileName}</span>
                <a 
                    href={file.data} 
                    download={file.fileName} 
                    className={`p-1 hover:bg-gray-200 rounded text-gray-600 ${tool === ToolType.SELECT ? 'pointer-events-auto' : 'pointer-events-none'}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Download"
                >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                </a>
            </div>

             {tool === ToolType.SELECT && (
                <div
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-gray-300 rounded-tl-lg shadow-sm cursor-nwse-resize z-20 flex items-center justify-center pointer-events-auto"
                    onPointerDown={(e) => handleResizePointerDown(e, file.id, 'file', file.width, file.height)}
                >
                    <ArrowsPointingOutIcon className="w-3 h-3 text-gray-600" />
                </div>
             )}
        </div>
      ))}

      {/* Images (z-10) */}
      {images.map(img => (
        <div
          key={img.id}
          className={`absolute border border-transparent hover:border-blue-200 transition-colors group touch-none ${itemPointerEvents}`}
          style={{ left: img.x, top: img.y, width: img.width, height: img.height, zIndex: 10 }}
          onPointerDown={(e) => handleItemPointerDown(e, img.id, 'image')}
        >
          <div className="relative w-full h-full">
             <img 
                src={img.src} 
                alt="Board Upload" 
                className="w-full h-full object-fill pointer-events-none select-none rounded shadow-md" 
             />
             {tool === ToolType.SELECT && (
              <button 
                onPointerDown={(e) => { e.stopPropagation(); deleteItem(img.id, 'image'); }}
                className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 shadow-sm z-20 pointer-events-auto hover:bg-red-600"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
             )}
             {tool === ToolType.SELECT && (
                <div
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-gray-300 rounded-tl-lg shadow-sm cursor-nwse-resize z-20 flex items-center justify-center pointer-events-auto"
                    onPointerDown={(e) => handleResizePointerDown(e, img.id, 'image', img.width, img.height || 200)}
                >
                    <ArrowsPointingOutIcon className="w-3 h-3 text-gray-600" />
                </div>
             )}
          </div>
        </div>
      ))}

      {/* Notes (z-20) */}
      {notes.map(note => (
        <div
          key={note.id}
          className={`absolute shadow-lg flex flex-col p-4 group touch-none ${itemPointerEvents}`}
          style={{
            left: note.x,
            top: note.y,
            width: note.width,
            height: note.height,
            backgroundColor: note.color,
            zIndex: 20,
            transform: dragItem?.id === note.id ? 'scale(1.02)' : 'none'
          }}
          onPointerDown={(e) => handleItemPointerDown(e, note.id, 'note')}
        >
          {tool === ToolType.SELECT && (
            <button 
              onPointerDown={(e) => { e.stopPropagation(); deleteItem(note.id, 'note'); }}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm z-30 pointer-events-auto hover:bg-red-600"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          )}
          <textarea
            className={`w-full h-full bg-transparent resize-none outline-none text-gray-800 font-medium placeholder-gray-400/70 select-text cursor-text ${itemPointerEvents}`}
            placeholder="Type here..."
            value={note.text}
            onChange={(e) => updateNoteText(note.id, e.target.value)}
            onPointerDown={(e) => e.stopPropagation()} 
          />
          {tool === ToolType.SELECT && (
            <div
                className="absolute bottom-0 right-0 w-6 h-6 bg-white/80 border border-gray-300 rounded-tl-lg shadow-sm cursor-nwse-resize z-30 flex items-center justify-center pointer-events-auto"
                onPointerDown={(e) => handleResizePointerDown(e, note.id, 'note', note.width, note.height)}
            >
                <ArrowsPointingOutIcon className="w-3 h-3 text-gray-800" />
            </div>
           )}
        </div>
      ))}

      {/* Remote Cursors (z-60) */}
      {remoteUsers.map(u => (
        u.cursor && (
          <div 
            key={u.clientId}
            className="absolute pointer-events-none transition-all duration-75 flex flex-col items-start z-[60]"
            style={{ 
              left: u.cursor.x, 
              top: u.cursor.y,
            }}
          >
            <ArrowTopRightOnSquareIcon 
              className="w-5 h-5 drop-shadow-md -ml-1 -mt-1" 
              style={{ color: u.user.color, transform: 'rotate(-90deg)' }} 
            />
            <span 
              className="px-2 py-0.5 rounded-md text-xs text-white font-medium shadow-sm whitespace-nowrap mt-1"
              style={{ backgroundColor: u.user.color }}
            >
              {u.user.name}
            </span>
          </div>
        )
      ))}
    </div>
  );
};