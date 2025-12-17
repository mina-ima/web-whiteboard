import React, { useState } from 'react';
import { XMarkIcon, SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { generateBrainstormingIdeas, analyzeBoard } from '../services/geminiService';

interface AiSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNotes: (notes: string[]) => void;
  getCanvasSnapshot: () => Promise<string>;
}

export const AiSidebar: React.FC<AiSidebarProps> = ({ isOpen, onClose, onAddNotes, getCanvasSnapshot }) => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [mode, setMode] = useState<'brainstorm' | 'analyze'>('brainstorm');

  if (!isOpen) return null;

  const handleBrainstorm = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setAnalysis(null);
    try {
      const ideas = await generateBrainstormingIdeas(topic);
      onAddNotes(ideas);
      setTopic('');
    } catch (e) {
      console.error(e);
      setAnalysis("アイデア生成に失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const snapshot = await getCanvasSnapshot();
      const result = await analyzeBoard(snapshot);
      setAnalysis(result);
    } catch (e) {
      console.error(e);
      setAnalysis("ボードの解析に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-40 flex flex-col border-l border-gray-200 transform transition-transform duration-300">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-purple-600" />
          AIアシスタント
        </h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button 
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'brainstorm' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setMode('brainstorm')}
          >
            アイデア出し
          </button>
          <button 
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'analyze' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setMode('analyze')}
          >
            ボード解析
          </button>
        </div>

        {mode === 'brainstorm' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">テーマを入力すると、付箋アイデアを自動生成します。</p>
            <textarea
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm resize-none"
              rows={3}
              placeholder="例：第3四半期のマーケ戦略..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <button 
              onClick={handleBrainstorm}
              disabled={loading || !topic.trim()}
              className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex justify-center items-center gap-2"
            >
              {loading && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
              付箋を生成
            </button>
          </div>
        )}

        {mode === 'analyze' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">現在のボード（手書き・付箋）を解析して要約します。</p>
            <button 
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex justify-center items-center gap-2"
            >
              {loading && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
              ボードを解析
            </button>
          </div>
        )}

        {/* Results Area */}
        {analysis && (
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4">
            <h3 className="text-sm font-bold text-gray-700 mb-2">解析結果:</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{analysis}</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-400 text-center">
        Google Gemini 2.5 Flash で動作中
      </div>
    </div>
  );
};
