
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Path, Point, ToolType, StickyNote, BoardImage, BoardFile, STICKY_COLORS } from '../types';
import { 
  XMarkIcon, 
  ArrowsPointingOutIcon, 
  DocumentIcon, 
  TableCellsIcon, 
  DocumentTextIcon, 
  PresentationChartBarIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

interface WhiteboardProps {
  tool: ToolType;
  paths: Path[];
  setPaths: React.Dispatch<React.SetStateAction<Path[]>>;
  notes: StickyNote[];
  setNotes: React.Dispatch<React.SetStateAction<StickyNote[]>>;
  images: BoardImage[];
  setImages: React.Dispatch<React.SetStateAction<BoardImage[]>>;
  files: BoardFile[];
  setFiles: React.Dispatch<React.SetStateAction<BoardFile[]>>;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({ 
  tool, paths, setPaths, notes, setNotes, images, setImages, files, setFiles
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [dragItem, setDragItem] = useState<{ type: 'note' | 'image' | 'file', id: string, offsetX: number, offsetY: number } | null>(null);
  const [resizeItem, setResizeItem] = useState<{ type: 'note' | 'image' | 'file', id: string, startX: number, startY: number, startWidth: number, startHeight: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number, h: number } | null>(null);

  // 1. Handle Resize Robustly
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
    handleResize(); // Initial size

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 2. Redraw function
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasSize) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    paths.forEach(path => {
      if (path.points.length < 1) return;
      ctx.beginPath();
      ctx.lineWidth = path.width;
      ctx.strokeStyle = path.color;
      ctx.moveTo(path.points[0].x, path.points[0].y);
      path.points.forEach((point, index) => {
        if (index > 0) ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    });

    if (currentPath.length > 0) {
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1e293b';
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      currentPath.forEach((point, index) => {
        if (index > 0) ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }
  }, [paths, currentPath, canvasSize]);

  useEffect(() => {
    if (canvasRef.current && canvasSize && containerRef.current) {
        canvasRef.current.width = canvasSize.w;
        canvasRef.current.height = canvasSize.h;
        
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.style.width = `${rect.width}px`;
        canvasRef.current.style.height = `${rect.height}px`;
        
        redraw();
    }
  }, [canvasSize, redraw]);


  // Helper: Geometry for Eraser
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

    setPaths(prevPaths => prevPaths.filter(path => {
      for (let i = 0; i < path.points.length - 1; i++) {
        if (distToSegment(pos, path.points[i], path.points[i + 1]) < ERASER_RADIUS) {
          return false; 
        }
      }
      return true;
    }));

    setNotes(prev => prev.filter(note => {
      return !(
        pos.x >= note.x && pos.x <= note.x + note.width && 
        pos.y >= note.y && pos.y <= note.y + note.height
      );
    }));

    setImages(prev => prev.filter(img => {
       return !(
        pos.x >= img.x && pos.x <= img.x + img.width && 
        pos.y >= img.y && pos.y <= img.y + (img.height || 200) 
      );
    }));

    setFiles(prev => prev.filter(f => {
       return !(
        pos.x >= f.x && pos.x <= f.x + f.width && 
        pos.y >= f.y && pos.y <= f.y + f.height 
      );
    }));
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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.target === canvasRef.current) {
      e.preventDefault();
    }

    const pos = getPos(e);

    if (dragItem || resizeItem) return;

    if (tool === ToolType.ERASER) {
      eraseAt(pos);
      (e.target as Element).setPointerCapture(e.pointerId);
      setIsDrawing(true); 
    } else if (tool === ToolType.PEN) {
      (e.target as Element).setPointerCapture(e.pointerId);
      setIsDrawing(true);
      setCurrentPath([pos]);
    } else if (tool === ToolType.NOTE) {
      const newNote: StickyNote = {
        id: uuidv4(),
        x: pos.x - 75,
        y: pos.y - 75,
        text: '',
        color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
        width: 200,
        height: 200
      };
      setNotes([...notes, newNote]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.preventDefault();
    const pos = getPos(e);

    if (resizeItem) {
        const dx = pos.x - resizeItem.startX;
        const dy = pos.y - resizeItem.startY;
        
        const newWidth = Math.max(50, resizeItem.startWidth + dx);
        const newHeight = Math.max(50, resizeItem.startHeight + dy);

        if (resizeItem.type === 'note') {
            setNotes(prev => prev.map(n => n.id === resizeItem.id ? { ...n, width: newWidth, height: newHeight } : n));
        } else if (resizeItem.type === 'image') {
            setImages(prev => prev.map(i => i.id === resizeItem.id ? { ...i, width: newWidth, height: newHeight } : i));
        } else if (resizeItem.type === 'file') {
            setFiles(prev => prev.map(f => f.id === resizeItem.id ? { ...f, width: newWidth, height: newHeight } : f));
        }
        return;
    }

    if (tool === ToolType.SELECT && dragItem) {
      if (dragItem.type === 'note') {
        setNotes(prev => prev.map(n => n.id === dragItem.id ? { ...n, x: pos.x - dragItem.offsetX, y: pos.y - dragItem.offsetY } : n));
      } else if (dragItem.type === 'image') {
        setImages(prev => prev.map(img => img.id === dragItem.id ? { ...img, x: pos.x - dragItem.offsetX, y: pos.y - dragItem.offsetY } : img));
      } else if (dragItem.type === 'file') {
        setFiles(prev => prev.map(f => f.id === dragItem.id ? { ...f, x: pos.x - dragItem.offsetX, y: pos.y - dragItem.offsetY } : f));
      }
      return;
    }

    if (tool === ToolType.ERASER && isDrawing) {
      eraseAt(pos);
      return;
    }

    if (!isDrawing || tool !== ToolType.PEN) return;
    
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    setCurrentPath(prev => {
        const newPoints = events.map(evt => {
            const rect = containerRef.current!.getBoundingClientRect();
            return {
                x: evt.clientX - rect.left,
                y: evt.clientY - rect.top
            };
        });
        return [...prev, ...newPoints];
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (dragItem) setDragItem(null);
    if (resizeItem) setResizeItem(null);

    if (isDrawing) {
        (e.target as Element).releasePointerCapture(e.pointerId);
        
        if (tool === ToolType.PEN && currentPath.length > 0) {
            const newPath: Path = {
              id: uuidv4(),
              points: currentPath,
              color: '#1e293b',
              width: 3
            };
            setPaths(prev => [...prev, newPath]);
        }
        
        setCurrentPath([]);
        setIsDrawing(false);
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

    setDragItem({
      type,
      id,
      offsetX: pos.x - itemX,
      offsetY: pos.y - itemY
    });
  };

  const handleResizePointerDown = (e: React.PointerEvent, id: string, type: 'note' | 'image' | 'file', w: number, h: number) => {
    e.stopPropagation();
    e.preventDefault();
    containerRef.current?.setPointerCapture(e.pointerId);

    const pos = getPos(e);
    setResizeItem({
        type,
        id,
        startX: pos.x,
        startY: pos.y,
        startWidth: w,
        startHeight: h
    });
  };

  const updateNoteText = (id: string, text: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, text } : n));
  };

  const deleteItem = (id: string, type: 'note' | 'image' | 'file') => {
    if (type === 'note') setNotes(prev => prev.filter(n => n.id !== id));
    if (type === 'image') setImages(prev => prev.filter(i => i.id !== id));
    if (type === 'file') setFiles(prev => prev.filter(f => f.id !== id));
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

  const areItemsInteractable = tool === ToolType.SELECT || tool === ToolType.NOTE || tool === ToolType.IMAGE;

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
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-0 touch-none" />

      {/* Render Files */}
      {files.map(file => (
        <div
            key={file.id}
            className={`absolute border border-gray-200 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow group touch-none flex flex-col items-center justify-center p-2 ${areItemsInteractable ? 'pointer-events-auto' : 'pointer-events-none'}`}
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

            {/* Icon Area */}
            <div className="flex-1 w-full flex items-center justify-center bg-gray-50 rounded mb-2">
                {getFileIcon(file.fileType)}
            </div>
            
            {/* Filename & Download */}
            <div className="w-full flex items-center justify-between text-xs px-1">
                <span className="truncate font-medium text-gray-700 max-w-[80%]">{file.fileName}</span>
                <a 
                    href={file.data} 
                    download={file.fileName} 
                    className="p-1 hover:bg-gray-200 rounded text-gray-600 pointer-events-auto"
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

      {/* Render Images */}
      {images.map(img => (
        <div
          key={img.id}
          className={`absolute border border-transparent hover:border-blue-200 transition-colors group touch-none ${areItemsInteractable ? 'pointer-events-auto' : 'pointer-events-none'}`}
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

      {/* Render Notes */}
      {notes.map(note => (
        <div
          key={note.id}
          className={`absolute shadow-lg flex flex-col p-4 group touch-none ${areItemsInteractable ? 'pointer-events-auto' : 'pointer-events-none'}`}
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
            className="w-full h-full bg-transparent resize-none outline-none text-gray-800 font-medium placeholder-gray-400/70 select-text cursor-text"
            placeholder="Type here..."
            value={note.text}
            onChange={(e) => updateNoteText(note.id, e.target.value)}
            onPointerDown={(e) => e.stopPropagation()} 
            readOnly={!areItemsInteractable}
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
    </div>
  );
};
