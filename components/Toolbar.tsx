
import React from 'react';
import { ToolType } from '../types';
import { 
  CursorArrowRaysIcon, 
  PencilIcon, 
  DocumentTextIcon, 
  PhotoIcon, 
  TrashIcon,
  SparklesIcon,
  BackspaceIcon
} from '@heroicons/react/24/outline';

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
  const buttonClass = (tool: ToolType) => 
    `p-3 rounded-xl transition-all duration-200 ${
      currentTool === tool 
        ? 'bg-indigo-600 text-white shadow-lg scale-105' 
        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 shadow-sm'
    }`;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-3 p-2 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 z-50">
      <button 
        onClick={() => setTool(ToolType.SELECT)} 
        className={buttonClass(ToolType.SELECT)}
        title="Select & Move"
      >
        <CursorArrowRaysIcon className="w-6 h-6" />
      </button>
      
      <button 
        onClick={() => setTool(ToolType.PEN)} 
        className={buttonClass(ToolType.PEN)}
        title="Freehand Pen"
      >
        <PencilIcon className="w-6 h-6" />
      </button>

      <button 
        onClick={() => setTool(ToolType.ERASER)} 
        className={buttonClass(ToolType.ERASER)}
        title="Eraser"
      >
        <BackspaceIcon className="w-6 h-6" />
      </button>

      <button 
        onClick={() => setTool(ToolType.NOTE)} 
        className={buttonClass(ToolType.NOTE)}
        title="Add Sticky Note"
      >
        <DocumentTextIcon className="w-6 h-6" />
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
          title="Upload Image or File"
        >
          <PhotoIcon className="w-6 h-6" />
        </label>
      </div>

      <div className="w-px h-8 bg-gray-300 mx-1"></div>

      <button 
        onClick={onClear} 
        className="p-3 rounded-xl bg-white text-red-500 hover:bg-red-50 border border-gray-200 shadow-sm transition-colors"
        title="Clear Board"
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
        title="AI Assistant"
      >
        <SparklesIcon className="w-6 h-6" />
        <span className="hidden sm:inline">AI Copilot</span>
      </button>
    </div>
  );
};
