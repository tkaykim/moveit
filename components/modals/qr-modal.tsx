"use client";

import { X, QrCode } from 'lucide-react';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QrModal = ({ isOpen, onClose }: QrModalProps) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in" 
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-neutral-900 rounded-3xl p-8 w-[80%] max-w-[320px] flex flex-col items-center relative border border-neutral-200 dark:border-neutral-800" 
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-neutral-400 hover:text-black dark:hover:text-white"
        >
          <X size={24} />
        </button>
        <h3 className="text-xl font-bold text-black dark:text-white mb-1">QR CHECK-IN</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">입장 시 리더기에 태그해주세요</p>
        <div className="w-56 h-56 bg-neutral-100 dark:bg-neutral-800 p-4 rounded-2xl mb-4 border border-neutral-200 dark:border-neutral-700">
          <div className="w-full h-full border-4 border-black dark:border-white flex items-center justify-center rounded-lg">
            <QrCode size={140} className="text-black dark:text-white" />
          </div>
        </div>
        <div className="text-sm font-medium text-red-500 dark:text-red-400 animate-pulse font-mono">02:59 남음</div>
      </div>
    </div>
  );
};



