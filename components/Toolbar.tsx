import React from 'react';
import { ToolType } from '../types';
import {
  CursorArrowRaysIcon as CursorArrowRaysIconOutline,
  PencilIcon as PencilIconOutline,
  DocumentTextIcon as DocumentTextIconOutline,
  PhotoIcon as PhotoIconOutline,
  TrashIcon,
  SparklesIcon,
  BackspaceIcon as BackspaceIconOutline,
} from '@heroicons/react/24/outline';
import {
  CursorArrowRaysIcon as CursorArrowRaysIconSolid,
  PencilIcon as PencilIconSolid,
  DocumentTextIcon as DocumentTextIconSolid,
  PhotoIcon as PhotoIconSolid,
  BackspaceIcon as BackspaceIconSolid,
} from '@heroicons/react/24/solid';

interface ToolbarProps {
  currentTool: ToolType;
  setTool: (tool: ToolType) => void;
  onClear: () => void;
  onAiToggle: () => void;
  isAiOpen: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  currentTool, 
  setTool, 
  onClear, 
  onAiToggle, 
  isAiOpen,
  onFileUpload
}) => {
  const toolConfig: Record<
    ToolType,
    {
      active: string;
      idle: string;
      Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
      ActiveIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    }
  > = {
    [ToolType.SELECT]: {
      active: 'bg-blue-600 text-white shadow-lg scale-105 border-blue-600',
      idle: 'bg-white text-blue-600 hover:bg-blue-50 border-blue-100 shadow-sm',
      Icon: CursorArrowRaysIconOutline,
      ActiveIcon: CursorArrowRaysIconSolid,
    },
    [ToolType.PEN]: {
      active: 'bg-slate-800 text-white shadow-lg scale-105 border-slate-800',
      idle: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 shadow-sm',
      Icon: PencilIconOutline,
      ActiveIcon: PencilIconSolid,
    },
    [ToolType.ERASER]: {
      active: 'bg-red-600 text-white shadow-lg scale-105 border-red-600',
      idle: 'bg-white text-red-600 hover:bg-red-50 border-red-100 shadow-sm',
      Icon: BackspaceIconOutline,
      ActiveIcon: BackspaceIconSolid,
    },
    [ToolType.NOTE]: {
      active: 'bg-amber-500 text-white shadow-lg scale-105 border-amber-500',
      idle: 'bg-white text-amber-600 hover:bg-amber-50 border-amber-100 shadow-sm',
      Icon: DocumentTextIconOutline,
      ActiveIcon: DocumentTextIconSolid,
    },
    [ToolType.IMAGE]: {
      active: 'bg-emerald-600 text-white shadow-lg scale-105 border-emerald-600',
      idle: 'bg-white text-emerald-600 hover:bg-emerald-50 border-emerald-100 shadow-sm',
      Icon: PhotoIconOutline,
      ActiveIcon: PhotoIconSolid,
    },
  };

  const buttonClass = (tool: ToolType) => {
    const config = toolConfig[tool];
    return `p-3 rounded-xl transition-all duration-200 border ${currentTool === tool ? config.active : config.idle}`;
  };

  const renderToolIcon = (tool: ToolType) => {
    const config = toolConfig[tool];
    const IconComponent = currentTool === tool ? config.ActiveIcon : config.Icon;
    return <IconComponent className="w-6 h-6" />;
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 p-2 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 z-[60]">
      <button 
        onClick={() => setTool(ToolType.SELECT)} 
        className={buttonClass(ToolType.SELECT)}
        title="選択・移動"
        aria-pressed={currentTool === ToolType.SELECT}
      >
        {renderToolIcon(ToolType.SELECT)}
      </button>
      
      <button 
        onClick={() => setTool(ToolType.PEN)} 
        className={buttonClass(ToolType.PEN)}
        title="フリーハンドペン"
        aria-pressed={currentTool === ToolType.PEN}
      >
        {renderToolIcon(ToolType.PEN)}
      </button>

      <button 
        onClick={() => setTool(ToolType.ERASER)} 
        className={buttonClass(ToolType.ERASER)}
        title="消しゴム"
        aria-pressed={currentTool === ToolType.ERASER}
      >
        {renderToolIcon(ToolType.ERASER)}
      </button>

      <button 
        onClick={() => setTool(ToolType.NOTE)} 
        className={buttonClass(ToolType.NOTE)}
        title="付箋を追加"
        aria-pressed={currentTool === ToolType.NOTE}
      >
        {renderToolIcon(ToolType.NOTE)}
      </button>

      <div className="relative">
        <input 
          type="file" 
          id="file-upload" 
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt"
          className="hidden" 
          onChange={onFileUpload}
        />
        <label 
          htmlFor="file-upload" 
          className={`cursor-pointer block ${buttonClass(ToolType.IMAGE)}`}
          title="画像またはファイルをアップロード"
          onClick={() => setTool(ToolType.IMAGE)}
          role="button"
          aria-pressed={currentTool === ToolType.IMAGE}
        >
          {renderToolIcon(ToolType.IMAGE)}
        </label>
      </div>

      <div className="w-px h-8 bg-gray-300 mx-1"></div>

      <button 
        onClick={onClear} 
        className="p-3 rounded-xl bg-white text-red-500 hover:bg-red-50 border border-gray-200 shadow-sm transition-colors"
        title="ボードをクリア"
      >
        <TrashIcon className="w-6 h-6" />
      </button>

      <button 
        onClick={onAiToggle} 
        className={`p-3 rounded-xl transition-all duration-200 flex items-center gap-2 font-medium ${
          isAiOpen
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg' 
            : 'bg-white text-purple-600 hover:bg-purple-50 border border-purple-100 shadow-sm'
        }`}
        title="AIアシスタント"
      >
        <SparklesIcon className="w-6 h-6" />
        <span className="hidden sm:inline">AIコパイロット</span>
      </button>
    </div>
  );
};
