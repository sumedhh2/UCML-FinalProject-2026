import React, { useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import SwipeCard from './components/SwipeCard';
import { IMAGES } from './data/images';
import { Heart, X, Sparkles, RefreshCw, Trophy } from 'lucide-react';

function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [preferences, setPreferences] = useState({});
  const [isFinished, setIsFinished] = useState(false);
  const [direction, setDirection] = useState(null);

  const handleSwipe = (dir) => {
    // Reset direction first to ensure the change is detected
    setDirection(null);
    
    // Use a tiny timeout to ensure the state reset is processed if needed, 
    // though Framer Motion's AnimatePresence should handle the 'custom' prop update.
    setTimeout(() => {
      setDirection(dir);
      const currentImage = IMAGES[currentIndex];
      
      if (dir === 'right') {
        setPreferences(prev => ({
          ...prev,
          [currentImage.aesthetic]: (prev[currentImage.aesthetic] || 0) + 1
        }));
      }

      if (currentIndex < IMAGES.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setIsFinished(true);
      }
    }, 10);
  };

  const aestheticProfile = useMemo(() => {
    if (Object.keys(preferences).length === 0) return null;
    return Object.entries(preferences)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
  }, [preferences]);

  const reset = () => {
    setCurrentIndex(0);
    setPreferences({});
    setIsFinished(false);
  };

  return (
    <div className="size-full min-h-screen bg-[#f8f9fa] text-[#171717] flex flex-col items-center justify-between py-8 px-4 max-w-md mx-auto relative overflow-hidden">
      {/* Header */}
      <div className="w-full text-center mb-4 z-50">
        <h1 className="text-4xl font-black tracking-tighter m-0">SWAG</h1>
        <p className="text-neutral-500 text-sm">Swipe to find your aesthetic</p>
      </div>

      {/* Main Content (Card Stack) */}
      <main className="relative w-full aspect-[3/4] flex items-center justify-center">
        {!isFinished ? (
          <>
            <AnimatePresence mode="popLayout" custom={direction}>
              {/* Top card */}
              <SwipeCard 
                key={IMAGES[currentIndex].id}
                image={IMAGES[currentIndex]}
                onSwipeLeft={() => handleSwipe('left')}
                onSwipeRight={() => handleSwipe('right')}
                isTop={true}
                direction={direction}
              />
            </AnimatePresence>
            
            {/* Show next card as a preview (behind the top card) */}
            {currentIndex + 1 < IMAGES.length && (
              <div className="absolute inset-0 -z-10 flex items-center justify-center">
                <SwipeCard 
                  key={IMAGES[currentIndex + 1].id}
                  image={IMAGES[currentIndex + 1]}
                  isTop={false}
                />
              </div>
            )}
          </>
        ) : (
          <div className="w-full bg-white rounded-3xl shadow-2xl p-10 border border-neutral-100 animate-in">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mb-8 border border-neutral-100">
                <Trophy className="w-10 h-10 text-neutral-800" />
              </div>
              <h2 className="text-3xl font-bold mb-3 tracking-tight">Your Aesthetic</h2>
              <p className="text-neutral-500 text-sm mb-10 leading-relaxed">We've analyzed your choices. Here are your top styles:</p>
              
              <div className="w-full space-y-3 mb-12">
                {aestheticProfile ? aestheticProfile.map(([style, count], index) => (
                  <div key={style} className="flex items-center gap-5 bg-neutral-50 p-5 rounded-3xl border border-neutral-100">
                    <div className="w-10 h-10 flex items-center justify-center bg-white rounded-2xl text-sm font-bold border border-neutral-100">
                      0{index + 1}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-lg font-bold capitalize">{style.replace('_', ' ')}</h3>
                      <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Matching Aesthetic</p>
                    </div>
                    <div className="text-neutral-800 font-black opacity-20">{count}</div>
                  </div>
                )) : (
                  <p>Start swiping to build your profile!</p>
                )}
              </div>

              <button 
                onClick={reset}
                className="w-full py-5 bg-[#171717] text-white rounded-3xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-5 h-5" />
                Reset Profile
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Action Buttons */}
      {!isFinished && (
        <div className="flex gap-6 mt-8 z-50">
          <button
            onClick={() => handleSwipe('left')}
            className="size-16 rounded-full bg-white border-2 border-red-500 text-red-500 shadow-lg hover:bg-red-50 transition-colors flex items-center justify-center active:scale-95"
          >
            <X size={32} />
          </button>
          <button
            onClick={() => handleSwipe('right')}
            className="size-16 rounded-full bg-white border-2 border-green-500 text-green-500 shadow-lg hover:bg-green-50 transition-colors flex items-center justify-center active:scale-95"
          >
            <Heart size={32} />
          </button>
        </div>
      )}

      {/* Progress Indicator */}
      <div className="mt-4 text-neutral-400 text-sm font-bold">
        {currentIndex + 1} / {IMAGES.length}
      </div>

      {/* Subtle Ambient Background */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-neutral-200/20 blur-[150px] rounded-full -z-20" />
    </div>
  );
}

export default App;
