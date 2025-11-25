
import React, { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Whiteboard } from './components/Whiteboard';
import { Toolbar } from './components/Toolbar';
import { AiSidebar } from './components/AiSidebar';
import { ToolType, Path, StickyNote, BoardImage, BoardFile, STICKY_COLORS } from './types';
import html2canvas from 'html2canvas';

const App: React.FC = () => {
  const [tool, setTool] = useState<ToolType>(ToolType.PEN);
  const [paths, setPaths] = useState<Path[]>([]);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [images, setImages] = useState<BoardImage[]>([]);
  const [files, setFiles] = useState<BoardFile[]>([]);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const appContainerRef = useRef<HTMLDivElement>(null);

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the board?')) {
      setPaths([]);
      setNotes([]);
      setImages([]);
      setFiles([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        
        if (file.type.startsWith('image/')) {
            const newImage: BoardImage = {
              id: uuidv4(),
              x: 100,
              y: 100,
              src: result,
              width: 300,
              height: 300, 
              title: file.name
            };
            setImages([...images, newImage]);
        } else {
            // Handle non-image files (docs, excel, pdf)
            const newFile: BoardFile = {
              id: uuidv4(),
              x: 100,
              y: 100,
              fileName: file.name,
              fileType: file.type || 'application/octet-stream',
              data: result,
              width: 220,
              height: 140
            };
            setFiles([...files, newFile]);
        }
        setTool(ToolType.SELECT);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddAiNotes = (ideas: string[]) => {
    // Arrange generated notes in a grid or random scatter near center
    const newNotes: StickyNote[] = ideas.map((idea, index) => ({
      id: uuidv4(),
      x: 150 + (index % 3) * 220,
      y: 150 + Math.floor(index / 3) * 220,
      text: idea,
      color: STICKY_COLORS[index % STICKY_COLORS.length],
      width: 200,
      height: 200
    }));
    setNotes(prev => [...prev, ...newNotes]);
    setTool(ToolType.SELECT);
  };

  const captureBoard = async (): Promise<string> => {
    if (appContainerRef.current) {
        // Hide UI elements before capture
        const canvas = await html2canvas(appContainerRef.current, {
            ignoreElements: (element) => {
               // Ignore the toolbar and the AI sidebar itself
               return element.tagName === 'BUTTON' || element.classList.contains('fixed');
            }
        });
        return canvas.toDataURL('image/png');
    }
    return '';
  };

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden relative" ref={appContainerRef}>
      {/* Header / Info */}
      <div className="absolute top-4 left-4 z-30 pointer-events-none select-none">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gemini SmartBoard</h1>
        <p className="text-sm text-slate-500">Collaborate, Brainstorm, Create</p>
      </div>

      <Whiteboard 
        tool={tool}
        paths={paths}
        setPaths={setPaths}
        notes={notes}
        setNotes={setNotes}
        images={images}
        setImages={setImages}
        files={files}
        setFiles={setFiles}
      />

      <Toolbar 
        currentTool={tool}
        setTool={setTool}
        onClear={handleClear}
        onAiToggle={() => setIsAiOpen(true)}
        isAiOpen={isAiOpen}
        onFileUpload={handleFileUpload}
      />

      <AiSidebar 
        isOpen={isAiOpen} 
        onClose={() => setIsAiOpen(false)} 
        onAddNotes={handleAddAiNotes}
        getCanvasSnapshot={async () => await captureBoard() as any} 
      />
    </div>
  );
};

export default App;
