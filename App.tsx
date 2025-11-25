import React, { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Whiteboard } from './components/Whiteboard';
import { Toolbar } from './components/Toolbar';
import { AiSidebar } from './components/AiSidebar';
import { LoginScreen } from './components/LoginScreen';
import { InviteModal } from './components/InviteModal';
import { ToolType, StickyNote, BoardImage, BoardFile, STICKY_COLORS } from './types';
import html2canvas from 'html2canvas';
import { UserIcon, ClipboardDocumentIcon, SignalIcon, SignalSlashIcon } from '@heroicons/react/24/outline';
import { useWhiteboardStore } from './hooks/useWhiteboardStore';

interface UserSession {
  userName: string;
  roomId: string;
  passcode: string;
}

const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  
  const [tool, setTool] = useState<ToolType>(ToolType.PEN);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const appContainerRef = useRef<HTMLDivElement>(null);

  // Hook into Real-time Store
  // If session is null, it won't connect.
  const { 
    paths, notes, images, files, isConnected,
    addPath, deletePaths, clearBoard,
    addNote, updateNote, deleteNote,
    addImage, updateImage, deleteImage,
    addFile, updateFile, deleteFile
  } = useWhiteboardStore(session?.roomId || null, session?.passcode || null, session?.userName || '');

  const handleLogin = (userName: string, roomId: string, passcode: string, isCreator: boolean) => {
    setSession({ userName, roomId, passcode });
    if (isCreator) {
        setShowInvite(true);
    }
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the board? This will clear it for everyone.')) {
      clearBoard();
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
            addImage(newImage);
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
            addFile(newFile);
        }
        setTool(ToolType.SELECT);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddAiNotes = (ideas: string[]) => {
    ideas.forEach((idea, index) => {
      const note: StickyNote = {
        id: uuidv4(),
        x: 150 + (index % 3) * 220,
        y: 150 + Math.floor(index / 3) * 220,
        text: idea,
        color: STICKY_COLORS[index % STICKY_COLORS.length],
        width: 200,
        height: 200
      };
      addNote(note);
    });
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

  if (!session) {
    return <LoginScreen onJoin={handleLogin} />;
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden relative" ref={appContainerRef}>
      {/* Header / Info */}
      <div className="absolute top-4 left-4 z-30 pointer-events-none select-none flex items-start gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gemini SmartBoard</h1>
            <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-500 font-medium bg-white/50 backdrop-blur px-2 py-1 rounded-md border border-slate-100 shadow-sm pointer-events-auto cursor-help" title="Click to view invite info" onClick={() => setShowInvite(true)}>
                Room: <span className="text-indigo-600">{session.roomId}</span>
            </p>
            <div className="w-px h-3 bg-slate-300"></div>
            <div className="flex items-center gap-1 text-sm text-slate-500">
                <UserIcon className="w-3 h-3" />
                <span>{session.userName}</span>
            </div>
             <div className="w-px h-3 bg-slate-300"></div>
            <div className={`flex items-center gap-1 text-sm ${isConnected ? 'text-green-600' : 'text-amber-500'}`}>
                {isConnected ? <SignalIcon className="w-3 h-3" /> : <SignalSlashIcon className="w-3 h-3" />}
                <span>{isConnected ? 'Live' : 'Connecting...'}</span>
            </div>
            </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-30">
        <button 
            onClick={() => setShowInvite(true)}
            className="p-2 bg-white text-indigo-600 rounded-full shadow-md hover:bg-gray-50 border border-gray-100 transition-colors"
            title="Show Invite Info"
        >
            <ClipboardDocumentIcon className="w-5 h-5" />
        </button>
      </div>

      {showInvite && (
        <InviteModal 
            roomId={session.roomId} 
            passcode={session.passcode} 
            onClose={() => setShowInvite(false)} 
        />
      )}

      <Whiteboard 
        tool={tool}
        paths={paths}
        notes={notes}
        images={images}
        files={files}
        
        onPathAdd={addPath}
        onPathsDelete={deletePaths}
        
        onNoteAdd={addNote}
        onNoteUpdate={updateNote}
        onNoteDelete={deleteNote}

        onImageUpdate={updateImage}
        onImageDelete={deleteImage}

        onFileUpdate={updateFile}
        onFileDelete={deleteFile}
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
        getCanvasSnapshot={captureBoard} 
      />
    </div>
  );
};

export default App;