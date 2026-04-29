import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import SwipeCard from './components/SwipeCard';
import { Heart, X, RefreshCw, Trophy } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userId, setUserId] = useState(null);
  const [images, setImages] = useState([]);
  const [isFinished, setIsFinished] = useState(false);
  const [direction, setDirection] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  // Initialize user and fetch first batch of images
  useEffect(() => {
    const initApp = async () => {
      try {
        // 1. Create User
        const userRes = await fetch(`${API_BASE}/users/create`, { method: 'POST' });
        const userData = await userRes.json();
        setUserId(userData.user_id);

        // 2. Fetch Initial Recommendations
        const recRes = await fetch(`${API_BASE}/recommendations/${userData.user_id}?batch_size=10`);
        const recData = await recRes.json();
        
        // Map backend keys to frontend expected keys
        const formattedImages = recData.recommendations.map(img => ({
          id: img.image_id,
          url: `${API_BASE}${img.image_url}`,
          aesthetic: img.style_label
        }));
        
        setImages(formattedImages);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to initialize app:", error);
      }
    };

    initApp();
  }, []);

  const fetchMoreImages = async (currentUserId) => {
    try {
      const res = await fetch(`${API_BASE}/recommendations/${currentUserId}?batch_size=10`);
      const data = await res.json();
      
      if (data.recommendations.length === 0) {
        finishSession(currentUserId);
        return;
      }

      const newImages = data.recommendations.map(img => ({
        id: img.image_id,
        url: `${API_BASE}${img.image_url}`,
        aesthetic: img.style_label
      }));

      setImages(prev => [...prev, ...newImages]);
    } catch (error) {
      console.error("Failed to fetch more images:", error);
    }
  };

  const finishSession = async (currentUserId) => {
    try {
      const res = await fetch(`${API_BASE}/profile/${currentUserId}`);
      const profileData = await res.json();
      setProfile(profileData);
      setIsFinished(true);
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      setIsFinished(true);
    }
  };

  const handleSwipe = async (dir) => {
    if (!images[currentIndex]) return;
    
    const currentImage = images[currentIndex];
    setDirection(null);
    
    // Log interaction to backend
    try {
      fetch(`${API_BASE}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          image_id: currentImage.id,
          liked: dir === 'right'
        })
      });
    } catch (error) {
      console.error("Failed to log interaction:", error);
    }

    setTimeout(() => {
      setDirection(dir);
      
      // Check if we need more images
      if (currentIndex === images.length - 2) {
        fetchMoreImages(userId);
      }

      // Finish after a certain amount or if backend empty
      if (currentIndex >= 20) { // arbitrary limit for demo
        finishSession(userId);
      } else if (currentIndex < images.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        finishSession(userId);
      }
    }, 10);
  };

  const reset = async () => {
    setIsLoading(true);
    setCurrentIndex(0);
    setIsFinished(false);
    setProfile(null);
    
    // Create new user for fresh session
    const userRes = await fetch(`${API_BASE}/users/create`, { method: 'POST' });
    const userData = await userRes.json();
    setUserId(userData.user_id);
    
    const recRes = await fetch(`${API_BASE}/recommendations/${userData.user_id}?batch_size=10`);
    const recData = await recRes.json();
    
    const formattedImages = recData.recommendations.map(img => ({
      id: img.image_id,
      url: `${API_BASE}${img.image_url}`,
      aesthetic: img.style_label
    }));
    
    setImages(formattedImages);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="size-full min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

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
              {images[currentIndex] && (
                <SwipeCard 
                  key={images[currentIndex].id}
                  image={images[currentIndex]}
                  onSwipeLeft={() => handleSwipe('left')}
                  onSwipeRight={() => handleSwipe('right')}
                  isTop={true}
                  direction={direction}
                />
              )}
            </AnimatePresence>
            
            {/* Show next card as a preview */}
            {currentIndex + 1 < images.length && (
              <div className="absolute inset-0 -z-10 flex items-center justify-center">
                <SwipeCard 
                  key={images[currentIndex + 1].id}
                  image={images[currentIndex + 1]}
                  isTop={false}
                />
              </div>
            )}
          </>
        ) : (
          <div className="w-full bg-white rounded-3xl shadow-2xl p-10 border border-neutral-100 overflow-y-auto max-h-full">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-6 border border-neutral-100">
                <Trophy className="w-8 h-8 text-neutral-800" />
              </div>
              <h2 className="text-2xl font-bold mb-2 tracking-tight">Your Style Profile</h2>
              <p className="text-neutral-500 text-xs mb-8">Generated based on your likes</p>
              
              <div className="w-full space-y-3 mb-10">
                {profile && profile.dominant_styles ? profile.dominant_styles.map((style, index) => (
                  <div key={style} className="flex items-center gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                    <div className="w-8 h-8 flex items-center justify-center bg-white rounded-xl text-xs font-bold border border-neutral-100">
                      0{index + 1}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-md font-bold capitalize">{style.replace('_', ' ')}</h3>
                    </div>
                  </div>
                )) : (
                  <p className="text-neutral-400">Loading your profile...</p>
                )}
              </div>

              {profile?.suggested_pieces_to_buy && (
                <div className="w-full text-left mb-10">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-4 px-2">Recommended Pieces</h4>
                  <div className="flex flex-wrap gap-2">
                    {profile.suggested_pieces_to_buy.slice(0, 6).map((item, i) => (
                      <span key={i} className="bg-neutral-100 px-3 py-2 rounded-full text-xs font-medium text-neutral-700 capitalize">
                        {item.piece}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button 
                onClick={reset}
                className="w-full py-4 bg-[#171717] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                New Session
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
            className="size-14 rounded-full bg-white border-2 border-red-500 text-red-500 shadow-lg hover:bg-red-50 transition-colors flex items-center justify-center active:scale-95"
          >
            <X size={28} />
          </button>
          <button
            onClick={() => handleSwipe('right')}
            className="size-14 rounded-full bg-white border-2 border-green-500 text-green-500 shadow-lg hover:bg-green-50 transition-colors flex items-center justify-center active:scale-95"
          >
            <Heart size={28} />
          </button>
        </div>
      )}

      {/* Progress Indicator */}
      {!isFinished && (
        <div className="mt-4 text-neutral-400 text-[10px] font-bold uppercase tracking-widest">
          Style Discovery: {currentIndex + 1}
        </div>
      )}

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-neutral-200/20 blur-[150px] rounded-full -z-20" />
    </div>
  );
}

export default App;
