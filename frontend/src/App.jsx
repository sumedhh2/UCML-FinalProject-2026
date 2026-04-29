import React, { useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import SwipeCard from './components/SwipeCard';
import { IMAGES } from './data/images';
import { Heart, X, Sparkles, RefreshCw, Trophy } from 'lucide-react';

function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [preferences, setPreferences] = useState({});
  const [isFinished, setIsFinished] = useState(false);

  const handleSwipe = (direction) => {
    const currentImage = IMAGES[currentIndex];
    
    if (direction === 'right') {
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
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 w-full p-6 flex justify-between items-center z-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-full flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Fashion Discovery</h1>
        </div>
        <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-md">
          <span className="text-sm font-medium text-white/60">
            {currentIndex + 1} / {IMAGES.length}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative w-full max-w-sm h-[600px] flex items-center justify-center">
        {!isFinished ? (
          <div className="relative w-full h-full">
            <AnimatePresence mode="popLayout">
              {/* Top card */}
              <SwipeCard 
                key={IMAGES[currentIndex].id}
                image={IMAGES[currentIndex]}
                onSwipeLeft={() => handleSwipe('left')}
                onSwipeRight={() => handleSwipe('right')}
                isTop={true}
              />
            </AnimatePresence>
            
            {/* Show next card as a preview (behind the top card) */}
            {currentIndex + 1 < IMAGES.length && (
              <div className="absolute inset-0 -z-10">
                <SwipeCard 
                  key={IMAGES[currentIndex + 1].id}
                  image={IMAGES[currentIndex + 1]}
                  isTop={false}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl animate-in fade-in zoom-in duration-500">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mb-6">
                <Trophy className="w-10 h-10 text-yellow-500" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Your Aesthetic Profile</h2>
              <p className="text-white/60 mb-8">Based on your swipes, here are your top styles:</p>
              
              <div className="w-full space-y-4 mb-10">
                {aestheticProfile ? aestheticProfile.map(([style, count], index) => (
                  <div key={style} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full text-lg font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm text-white/40 uppercase tracking-widest font-semibold">Style</p>
                      <h3 className="text-xl font-bold capitalize">{style.replace('_', ' ')}</h3>
                    </div>
                    <div className="text-pink-500 font-bold">{count} likes</div>
                  </div>
                )) : (
                  <p>You didn't like any styles yet!</p>
                )}
              </div>

              <button 
                onClick={reset}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="w-5 h-5" />
                Start Over
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Control Buttons */}
      {!isFinished && (
        <div className="fixed bottom-12 flex items-center gap-6 z-50">
          <button 
            onClick={() => handleSwipe('left')}
            className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center hover:bg-red-500/10 hover:border-red-500/50 transition-all active:scale-90"
          >
            <X className="w-8 h-8 text-red-500" />
          </button>
          <button 
            onClick={() => handleSwipe('right')}
            className="w-20 h-20 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-pink-500/20 hover:scale-105 transition-all active:scale-95"
          >
            <Heart className="w-10 h-10 text-white fill-white" />
          </button>
        </div>
      )}

      {/* Decorative Background */}
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full -z-10" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-pink-500/20 blur-[120px] rounded-full -z-10" />
    </div>
  );
}

export default App;
