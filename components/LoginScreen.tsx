import React, { useState } from 'react';
import { SparklesIcon, LockClosedIcon, UserIcon, HashtagIcon, PlusCircleIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';

interface LoginScreenProps {
  onJoin: (userName: string, roomId: string, password: string, isCreator: boolean) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onJoin }) => {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  
  const [userName, setUserName] = useState('');
  // Join Mode Inputs
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinPasscode, setJoinPasscode] = useState('');
  
  // Create Mode Inputs
  const [createPasscode, setCreatePasscode] = useState('');
  
  const [error, setError] = useState('');

  const generateRoomId = () => {
    // Generate a random 4-digit number string
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return randomNum.toString();
  };

  const handleRoomIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers
    const val = e.target.value.replace(/[^0-9]/g, '');
    setJoinRoomId(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!userName.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (mode === 'create') {
      const newRoomId = generateRoomId();
      onJoin(userName, newRoomId, createPasscode, true);
    } else {
      if (!joinRoomId.trim()) {
        setError('Room ID is required.');
        return;
      }
      onJoin(userName, joinRoomId.trim(), joinPasscode, false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-4 z-[70] dot-grid">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-indigo-600 p-6 text-center">
          <div className="mx-auto bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-3 backdrop-blur-sm">
            <SparklesIcon className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Gemini SmartBoard</h1>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => { setMode('create'); setError(''); }}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              mode === 'create' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <PlusCircleIcon className="w-4 h-4" />
            Create New Board
          </button>
          <button
            onClick={() => { setMode('join'); setError(''); }}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              mode === 'join' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Join Board
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Your Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                placeholder="Ex. Alice"
              />
            </div>
          </div>

          {mode === 'create' ? (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
               <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Set Password (Optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    value={createPasscode}
                    onChange={(e) => setCreatePasscode(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                    placeholder="Create a password for this board"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 ml-1">Share this password with others to let them join.</p>
              </div>
              
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-200 transition-all text-sm"
              >
                Create & Enter
              </button>
            </div>
          ) : (
            <div className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Room ID (Number)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HashtagIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={joinRoomId}
                    onChange={handleRoomIdChange}
                    className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm font-mono"
                    placeholder="Ex. 1234"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LockClosedIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    value={joinPasscode}
                    onChange={(e) => setJoinPasscode(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                    placeholder="Enter room password"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-white text-indigo-600 font-semibold py-3 px-4 rounded-xl border border-indigo-200 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all text-sm shadow-sm"
              >
                Join Board
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};