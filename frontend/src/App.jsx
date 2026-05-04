import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useSwipeSession } from './hooks/useSwipeSession';
import SwipeDeck from './components/SwipeDeck';
import SwipeControls from './components/SwipeControls';
import LikedHistory from './components/LikedHistory';
import ProfileView from './components/ProfileView';

/**
 * App
 * ──────────────────────────────────────────────────────────────────────────
 * Top-level orchestrator. All business logic lives in `useSwipeSession`;
 * all UI lives in focused, single-responsibility components.
 *
 * Render tree:
 *   Loading  → spinner
 *   Swiping  → SwipeDeck + SwipeControls | LikedHistory sidebar
 *   Finished → ProfileView
 */
function App() {
  const {
    images,
    currentIndex,
    direction,
    isLoading,
    isFinished,
    profile,
    likedImages,
    profileReadiness,
    isProfileStable,
    hasMore,
    handleSwipe,
    finishSession,
    reset,
  } = useSwipeSession();

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-300" />
      </div>
    );
  }

  // ── Finished → full-page profile report ───────────────────────────────────
  if (isFinished) {
    return <ProfileView profile={profile} onReset={reset} />;
  }

  const isEndOfDeck = currentIndex >= images.length && !hasMore;

  // ── Active swiping session ─────────────────────────────────────────────────
  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-50 to-slate-100
                    flex flex-col md:flex-row overflow-hidden">

      {/* ── Main panel ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center
                       p-4 md:p-6 lg:p-8 overflow-hidden">
        {/* Header - Compacted */}
        <header className="mb-8 text-center flex-shrink-0 w-full max-w-md relative z-20">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 tracking-tighter">
            S.W.A.G.
          </h1>
          <p className="text-slate-400 text-[10px] uppercase tracking-[0.3em] mt-1">
            Discover Your Aesthetic
          </p>
        </header>

        {/* Card deck + buttons - Flex-grow allows it to take available space */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full">
          <div className="flex items-center justify-center w-full max-w-2xl px-4">
            {/* Deck / End State */}
            <div className="flex-1 flex justify-center relative">
              {isEndOfDeck ? (
                <div className="w-full max-w-sm aspect-[3/4] bg-white/50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <RefreshCw className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">That's everything!</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    We've run out of recommendations for now. You've gathered enough style data to see your profile!
                  </p>
                </div>
              ) : (
                <SwipeDeck
                  images={images}
                  currentIndex={currentIndex}
                  direction={direction}
                  onSwipeLeft={() => handleSwipe('left')}
                  onSwipeRight={() => handleSwipe('right')}
                />
              )}
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-col items-center gap-3 w-full max-w-xs flex-shrink-0">
          {!isEndOfDeck && (
            <SwipeControls
              onSwipeLeft={() => handleSwipe('left')}
              onSwipeRight={() => handleSwipe('right')}
              disabled={!images[currentIndex]}
            />
          )}

          {/* Integrated Progress / CTA Button */}
          <div className="w-full h-12 relative mt-2">
            {!isProfileStable ? (
              /* Stylish Progress Pill */
              <div className="w-full h-full bg-slate-100 rounded-2xl overflow-hidden relative border border-slate-200">
                <div 
                  className="absolute inset-y-0 left-0 bg-slate-900 transition-all duration-1000 ease-out"
                  style={{ width: `${profileReadiness}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center mix-blend-difference text-white">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Gathering Style Data • {Math.round(profileReadiness)}%
                  </span>
                </div>
              </div>
            ) : (
              /* Final CTA Button */
              <button
                onClick={finishSession}
                className="w-full h-full bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 animate-in"
              >
                View Style Identity
              </button>
            )}
          </div>

          {isEndOfDeck && (
            <button 
              onClick={reset}
              className="text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-slate-600 transition-colors mt-2"
            >
              Start New Session
            </button>
          )}
        </div>
      </main>

      {/* ── Liked-history sidebar ─────────────────────────────────────────── */}
      <LikedHistory outfits={likedImages} />
    </div>
  );
}

export default App;
