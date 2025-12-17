import React, { useEffect, useRef, useState } from 'react';
import { ToolType, PenStyle, PEN_STYLES } from '../types';
import {
  CursorArrowRaysIcon as CursorArrowRaysIconOutline,
  PencilIcon as PencilIconOutline,
  DocumentTextIcon as DocumentTextIconOutline,
  PhotoIcon as PhotoIconOutline,
  Bars2Icon,
  ChevronUpIcon,
  ChevronDownIcon,
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
  penStyle: PenStyle;
  setPenStyle: (style: PenStyle) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  currentTool, 
  setTool, 
  onClear, 
  onAiToggle, 
  isAiOpen,
  onFileUpload,
  penStyle,
  setPenStyle
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

  useEffect(() => {
    if (!position || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nextX = clamp(position.x, 8, window.innerWidth - rect.width - 8);
    const nextY = clamp(position.y, 8, window.innerHeight - rect.height - 8);
    if (nextX !== position.x || nextY !== position.y) {
      setPosition({ x: nextX, y: nextY });
    }
  }, [position]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  const handleDragStart = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const base = position ?? { x: rect.left, y: rect.top };
    if (!position) {
      setPosition(base);
    }
    dragOffsetRef.current = { x: e.clientX - base.x, y: e.clientY - base.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!dragOffsetRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nextX = clamp(
      e.clientX - dragOffsetRef.current.x,
      8,
      window.innerWidth - rect.width - 8
    );
    const nextY = clamp(
      e.clientY - dragOffsetRef.current.y,
      8,
      window.innerHeight - rect.height - 8
    );
    setPosition({ x: nextX, y: nextY });
  };

  const handleDragEnd = (e: React.PointerEvent) => {
    dragOffsetRef.current = null;
    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  const handleToolSelect = (tool: ToolType) => {
    setTool(tool);
    if (isMobile) setIsMenuOpen(false);
  };

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
    <div
      ref={containerRef}
      className={`fixed z-[60] flex items-center gap-2 p-2 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 ${
        position ? '' : 'bottom-6 left-1/2 -translate-x-1/2'
      }`}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <button
        className="p-2 rounded-xl bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 shadow-sm cursor-move"
        title="ツールバーを移動"
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
      >
        <Bars2Icon className="w-5 h-5" />
      </button>

      {!isMobile && (
        <button
          className="p-2 rounded-xl bg-white text-slate-500 hover:bg-slate-50 border border-slate-200 shadow-sm"
          title={isCollapsed ? 'ツールバーを展開' : 'ツールバーを折りたたむ'}
          onClick={() => setIsCollapsed((prev) => !prev)}
        >
          {isCollapsed ? (
            <ChevronUpIcon className="w-5 h-5" />
          ) : (
            <ChevronDownIcon className="w-5 h-5" />
          )}
        </button>
      )}

      {!isMobile && !isCollapsed && (
        <>
          <button 
            onClick={() => handleToolSelect(ToolType.SELECT)} 
            className={buttonClass(ToolType.SELECT)}
            title="選択・移動"
            aria-pressed={currentTool === ToolType.SELECT}
          >
            {renderToolIcon(ToolType.SELECT)}
          </button>
          
          <button 
            onClick={() => handleToolSelect(ToolType.PEN)} 
            className={buttonClass(ToolType.PEN)}
            title="フリーハンドペン"
            aria-pressed={currentTool === ToolType.PEN}
          >
            {renderToolIcon(ToolType.PEN)}
          </button>

          {currentTool === ToolType.PEN && (
            <div className="flex items-center gap-1 px-1">
              {PEN_STYLES.map((style) => {
                const isActive = penStyle.id === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    title={`${style.label}ペン`}
                    onClick={() => {
                      setPenStyle(style);
                      handleToolSelect(ToolType.PEN);
                    }}
                    className={`w-6 h-6 rounded-full border transition-all ${
                      isActive
                        ? 'ring-2 ring-slate-400 border-slate-400 shadow-sm'
                        : 'border-slate-200 hover:shadow-sm'
                    }`}
                    style={{ backgroundColor: style.color }}
                  >
                    <span className="sr-only">{style.label}ペン</span>
                  </button>
                );
              })}
            </div>
          )}

          <button 
            onClick={() => handleToolSelect(ToolType.ERASER)} 
            className={buttonClass(ToolType.ERASER)}
            title="消しゴム"
            aria-pressed={currentTool === ToolType.ERASER}
          >
            {renderToolIcon(ToolType.ERASER)}
          </button>

          <button 
            onClick={() => handleToolSelect(ToolType.NOTE)} 
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
              onClick={() => handleToolSelect(ToolType.IMAGE)}
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
        </>
      )}

      {!isMobile && (
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
      )}

      {isMobile && (
        <div className="relative">
          <button
            type="button"
            className="p-2 rounded-xl bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm"
            title="ツールを開く"
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            {isMenuOpen ? (
              <ChevronDownIcon className="w-5 h-5" />
            ) : (
              <ChevronUpIcon className="w-5 h-5" />
            )}
          </button>

          {isMenuOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-56 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-xl p-2 flex flex-col gap-2">
              <div className="grid grid-cols-5 gap-2">
                <button
                  onClick={() => handleToolSelect(ToolType.SELECT)}
                  className={buttonClass(ToolType.SELECT)}
                  title="選択・移動"
                  aria-pressed={currentTool === ToolType.SELECT}
                >
                  {renderToolIcon(ToolType.SELECT)}
                </button>
                <button
                  onClick={() => handleToolSelect(ToolType.PEN)}
                  className={buttonClass(ToolType.PEN)}
                  title="フリーハンドペン"
                  aria-pressed={currentTool === ToolType.PEN}
                >
                  {renderToolIcon(ToolType.PEN)}
                </button>
                <button
                  onClick={() => handleToolSelect(ToolType.ERASER)}
                  className={buttonClass(ToolType.ERASER)}
                  title="消しゴム"
                  aria-pressed={currentTool === ToolType.ERASER}
                >
                  {renderToolIcon(ToolType.ERASER)}
                </button>
                <button
                  onClick={() => handleToolSelect(ToolType.NOTE)}
                  className={buttonClass(ToolType.NOTE)}
                  title="付箋を追加"
                  aria-pressed={currentTool === ToolType.NOTE}
                >
                  {renderToolIcon(ToolType.NOTE)}
                </button>
                <label
                  htmlFor="file-upload"
                  className={`cursor-pointer block ${buttonClass(ToolType.IMAGE)}`}
                  title="画像またはファイルをアップロード"
                  onClick={() => handleToolSelect(ToolType.IMAGE)}
                  role="button"
                  aria-pressed={currentTool === ToolType.IMAGE}
                >
                  {renderToolIcon(ToolType.IMAGE)}
                </label>
              </div>

              {currentTool === ToolType.PEN && (
                <div className="flex flex-wrap gap-2">
                  {PEN_STYLES.map((style) => {
                    const isActive = penStyle.id === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        title={`${style.label}ペン`}
                        onClick={() => {
                          setPenStyle(style);
                          handleToolSelect(ToolType.PEN);
                        }}
                        className={`w-6 h-6 rounded-full border transition-all ${
                          isActive
                            ? 'ring-2 ring-slate-400 border-slate-400 shadow-sm'
                            : 'border-slate-200 hover:shadow-sm'
                        }`}
                        style={{ backgroundColor: style.color }}
                      >
                        <span className="sr-only">{style.label}ペン</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onAiToggle();
                    setIsMenuOpen(false);
                  }}
                  className={`flex-1 px-2 py-2 rounded-xl text-xs font-medium border transition-colors ${
                    isAiOpen
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent'
                      : 'bg-white text-purple-600 border-purple-100'
                  }`}
                  title="AIアシスタント"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <SparklesIcon className="w-4 h-4" />
                    AI
                  </span>
                </button>
                <button
                  onClick={() => {
                    onClear();
                    setIsMenuOpen(false);
                  }}
                  className="px-2 py-2 rounded-xl bg-white text-red-500 border border-gray-200 text-xs font-medium"
                  title="ボードをクリア"
                >
                  クリア
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
