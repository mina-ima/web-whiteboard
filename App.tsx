import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Whiteboard } from './components/Whiteboard';
import { Toolbar } from './components/Toolbar';
import { AiSidebar } from './components/AiSidebar';
import { LoginScreen } from './components/LoginScreen';
import { InviteModal } from './components/InviteModal';
import { ToolType, StickyNote, BoardImage, BoardFile, STICKY_COLORS, PEN_STYLES } from './types';
import html2canvas from 'html2canvas';
import { UserIcon, SignalIcon, SignalSlashIcon, UsersIcon, ShieldCheckIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useWhiteboardStore } from './hooks/useWhiteboardStore';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';

interface UserSession {
  userName: string;
  roomId: string;
  passcode: string;
  isCreator: boolean;
}

const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [loginError, setLoginError] = useState<string>('');
  
  const [tool, setTool] = useState<ToolType>(ToolType.PEN);
  const [penStyle, setPenStyle] = useState(PEN_STYLES[0]);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const appContainerRef = useRef<HTMLDivElement>(null);

  // Hook into Real-time Store
  const { 
    paths, notes, images, files, isConnected, remoteUsers, connectionError, isAuthenticating,
    addPath, deletePaths, updatePaths, clearBoard,
    addNote, updateNote, deleteNote,
    addImage, updateImage, deleteImage,
    addFile, updateFile, deleteFile,
    updateCursor
  } = useWhiteboardStore(session?.roomId || null, session?.passcode || null, session?.userName || '', session?.isCreator || false);

  // Handle Connection Errors (e.g. Wrong Password)
  useEffect(() => {
    if (connectionError && session) {
        setSession(null); // Logout
        setLoginError(connectionError);
    }
  }, [connectionError, session]);

  const handleLogin = (userName: string, roomId: string, passcode: string, isCreator: boolean) => {
    setLoginError('');
    setSession({ userName, roomId, passcode, isCreator });
    if (isCreator) {
        setShowInvite(true);
    }
  };

  const handleClear = () => {
    if (window.confirm('ボードをクリアしてもよろしいですか？この操作は全員に適用されます。')) {
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
        x: 120 + (index % 3) * 220,
        y: 140 + Math.floor(index / 3) * 90,
        text: idea,
        color: STICKY_COLORS[0],
        width: 200,
        height: 50
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

  const dataUrlToUint8Array = (dataUrl: string) => {
    const base64 = dataUrl.split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  const ensureUniqueName = (existing: Set<string>, name: string) => {
    if (!existing.has(name)) {
      existing.add(name);
      return name;
    }
    const dotIndex = name.lastIndexOf('.');
    const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
    const ext = dotIndex > 0 ? name.slice(dotIndex) : '';
    let counter = 2;
    let nextName = `${base} (${counter})${ext}`;
    while (existing.has(nextName)) {
      counter += 1;
      nextName = `${base} (${counter})${ext}`;
    }
    existing.add(nextName);
    return nextName;
  };

  const handleExportZip = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const zip = new JSZip();
      const existingNames = new Set<string>();

      const boardImage = await captureBoard();
      if (boardImage) {
        const img = new Image();
        img.src = boardImage;
        await img.decode();
        const orientation = img.width >= img.height ? 'landscape' : 'portrait';
        const pdf = new jsPDF({
          orientation,
          unit: 'pt',
          format: [img.width, img.height],
        });
        pdf.addImage(boardImage, 'PNG', 0, 0, img.width, img.height);
        zip.file('board.pdf', pdf.output('blob'));
        existingNames.add('board.pdf');
      }

      images.forEach((image, index) => {
        if (!image.src) return;
        const name = ensureUniqueName(
          existingNames,
          image.title || `image-${index + 1}.png`
        );
        zip.file(name, dataUrlToUint8Array(image.src));
      });

      files.forEach((file, index) => {
        if (!file.data) return;
        const name = ensureUniqueName(
          existingNames,
          file.fileName || `file-${index + 1}`
        );
        zip.file(name, dataUrlToUint8Array(file.data));
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const dateTag = new Date().toISOString().slice(0, 10);
      const roomTag = session?.roomId ? `-${session.roomId}` : '';
      saveAs(blob, `whiteboard${roomTag}-${dateTag}.zip`);
    } catch (error) {
      console.error(error);
      window.alert('エクスポートに失敗しました。もう一度お試しください。');
    } finally {
      setIsExporting(false);
    }
  };

  if (!session) {
    return <LoginScreen onJoin={handleLogin} initialError={loginError} />;
  }

  // Verification Loading Screen
  if (isAuthenticating) {
      return (
          <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-50 dot-grid">
              <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center max-w-sm w-full border border-gray-100 animate-in fade-in zoom-in-95">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4 text-indigo-600">
                      <ArrowPathIcon className="w-8 h-8 animate-spin" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 mb-2">ボードに接続中...</h2>
                  <p className="text-sm text-gray-500 text-center mb-6">
                      ルームIDとパスワードを確認しています。
                  </p>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 animate-pulse w-2/3 rounded-full"></div>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden relative" ref={appContainerRef}>
      {/* Compact Header / Info */}
      <div className="absolute top-2 left-2 z-30 pointer-events-auto select-none">
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur px-2 py-1 rounded-full border border-slate-200 shadow-sm text-xs">
            <button
                className="font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                title="招待情報を表示"
                onClick={() => setShowInvite(true)}
            >
                ルーム: <span className="font-mono text-indigo-600">{session.roomId}</span>
            </button>
            <div className="w-px h-3 bg-slate-300"></div>
            <div className={`flex items-center gap-1 ${isConnected ? 'text-green-600' : 'text-amber-500'}`}>
                {isConnected ? <SignalIcon className="w-3 h-3" /> : <SignalSlashIcon className="w-3 h-3" />}
                <span>{isConnected ? '接続済み' : '再接続中...'}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-slate-600">
                <UsersIcon className="w-3 h-3" />
                <span>{remoteUsers.length + 1}</span>
            </div>
            <div className="hidden md:flex items-center gap-1 text-slate-500">
                <UserIcon className="w-3 h-3" />
                <span>{session.userName}</span>
            </div>
            {session.passcode && (
                 <div className="hidden md:flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    <ShieldCheckIcon className="w-3 h-3" />
                    <span>暗号化</span>
                </div>
            )}
        </div>
      </div>

      <div className="absolute top-2 right-2 z-30 pointer-events-auto select-none">
        <button
          type="button"
          onClick={handleExportZip}
          disabled={isExporting}
          className={`flex items-center gap-1.5 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full border text-xs font-medium shadow-sm transition-colors ${
            isExporting
              ? 'text-slate-400 border-slate-200'
              : 'text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
          title="ボードPDFと添付ファイルをZIPで保存"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          <span>{isExporting ? '書き出し中...' : 'ZIP保存'}</span>
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
        remoteUsers={remoteUsers}
        
        onPathAdd={addPath}
        onPathsDelete={deletePaths}
        onPathsUpdate={updatePaths}
        
        onNoteAdd={addNote}
        onNoteUpdate={updateNote}
        onNoteDelete={deleteNote}

        onImageUpdate={updateImage}
        onImageDelete={deleteImage}

        onFileUpdate={updateFile}
        onFileDelete={deleteFile}

        onCursorMove={updateCursor}
        penStyle={penStyle}
      />

      <Toolbar 
        currentTool={tool}
        setTool={setTool}
        onClear={handleClear}
        onAiToggle={() => {
          setTool(ToolType.NOTE);
          setIsAiOpen(true);
        }}
        isAiOpen={isAiOpen}
        onFileUpload={handleFileUpload}
        penStyle={penStyle}
        setPenStyle={setPenStyle}
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
