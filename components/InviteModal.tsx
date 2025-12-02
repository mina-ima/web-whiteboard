import React from 'react';
import { XMarkIcon, ClipboardDocumentCheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';

interface InviteModalProps {
  roomId: string;
  passcode: string;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ roomId, passcode, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const text = `Join my Gemini SmartBoard!\nRoom ID: ${roomId}\nPassword: ${passcode}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative border border-gray-100">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-gray-800 mb-2">Board Created! 🎉</h3>
        <p className="text-sm text-gray-500 mb-6">
          Share these details with your team so they can join this secure session.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-4">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Room ID</span>
            <p className="text-2xl font-mono font-bold text-indigo-600 tracking-wide mt-1">{roomId}</p>
          </div>
          
          <div className="w-full h-px bg-gray-200"></div>

          <div>
             <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</span>
             <p className="text-lg font-mono font-medium text-gray-800 mt-1">{passcode || <span className="text-gray-400 italic">No password set</span>}</p>
          </div>
        </div>

        <button 
          onClick={handleCopy}
          className={`mt-6 w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-all ${
            copied 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
          }`}
        >
          {copied ? (
            <>
              <ClipboardDocumentCheckIcon className="w-5 h-5" />
              Copied to Clipboard
            </>
          ) : (
            <>
              <ClipboardDocumentIcon className="w-5 h-5" />
              Copy Invitation
            </>
          )}
        </button>
      </div>
    </div>
  );
};