import React, { useEffect } from 'react';
import { Heart, X } from 'lucide-react';

/**
 * SwipeControls
 * The Like / Nope buttons and keyboard shortcut hint.
 * Also owns the global keydown listener so it lives next to the UI it controls.
 */
const SwipeControls = ({ onSwipeLeft, onSwipeRight, disabled }) => {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (disabled) return;
      if (e.key === 'ArrowLeft') onSwipeLeft();
      if (e.key === 'ArrowRight') onSwipeRight();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, onSwipeLeft, onSwipeRight]);

  return (
    <div className="flex flex-col items-center gap-3 mt-8">
      <div className="flex gap-6">
        <button
          onClick={onSwipeLeft}
          disabled={disabled}
          aria-label="Pass"
          className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white shadow-xl flex items-center justify-center
                     hover:scale-110 transition-transform active:scale-95 border border-slate-100
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X className="w-6 h-6 md:w-7 md:h-7 text-red-500" />
        </button>

        <button
          onClick={onSwipeRight}
          disabled={disabled}
          aria-label="Like"
          className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white shadow-xl flex items-center justify-center
                     hover:scale-110 transition-transform active:scale-95 border border-slate-100
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Heart className="w-6 h-6 md:w-7 md:h-7 text-green-500" />
        </button>
      </div>

    </div>
  );
};

export default SwipeControls;
