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
      iconClass: string;
      activeIconClass: string;
      Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
      ActiveIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    }
  > = {
    [ToolType.SELECT]: {
      active: 'bg-blue-100 shadow-lg scale-105 border-blue-300 ring-2 ring-blue-200/60',
      idle: 'bg-white hover:bg-blue-50 border-blue-100 shadow-sm',
      iconClass: 'text-blue-600',
      activeIconClass: 'text-blue-700',
      Icon: CursorArrowRaysIconOutline,
      ActiveIcon: CursorArrowRaysIconSolid,
    },
    [ToolType.PEN]: {
      active: 'bg-slate-100 shadow-lg scale-105 border-slate-300 ring-2 ring-slate-200/70',
      idle: 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm',
      iconClass: 'text-slate-700',
      activeIconClass: 'text-slate-900',
      Icon: PencilIconOutline,
      ActiveIcon: PencilIconSolid,
    },
    [ToolType.ERASER]: {
      active: 'bg-red-100 shadow-lg scale-105 border-red-300 ring-2 ring-red-200/70',
      idle: 'bg-white hover:bg-red-50 border-red-100 shadow-sm',
      iconClass: 'text-red-600',
      activeIconClass: 'text-red-700',
      Icon: BackspaceIconOutline,
      ActiveIcon: BackspaceIconSolid,
    },
    [ToolType.NOTE]: {
      active: 'bg-amber-100 shadow-lg scale-105 border-amber-300 ring-2 ring-amber-200/70',
      idle: 'bg-white hover:bg-amber-50 border-amber-100 shadow-sm',
      iconClass: 'text-amber-600',
      activeIconClass: 'text-amber-700',
      Icon: DocumentTextIconOutline,
      ActiveIcon: DocumentTextIconSolid,
    },
    [ToolType.IMAGE]: {
      active: 'bg-emerald-100 shadow-lg scale-105 border-emerald-300 ring-2 ring-emerald-200/70',
      idle: 'bg-white hover:bg-emerald-50 border-emerald-100 shadow-sm',
      iconClass: 'text-emerald-600',
      activeIconClass: 'text-emerald-700',
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
    const iconClass = currentTool === tool ? config.activeIconClass : config.iconClass;
    return <IconComponent className={`w-6 h-6 ${iconClass}`} />;
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
        className={`p-3 rounded-xl transition-all duration-200 ${
          isAiOpen
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg' 
            : 'bg-white text-purple-600 hover:bg-purple-50 border border-purple-100 shadow-sm'
        }`}
        title="AIアシスタント"
      >
        <SparklesIcon className="w-6 h-6" />
      </button>
    </div>
  );
};
