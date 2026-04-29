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
  const [likedImages, setLikedImages] = useState([]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isFinished || isLoading) return;
      if (e.key === 'ArrowLeft') handleSwipe('left');
      if (e.key === 'ArrowRight') handleSwipe('right');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFinished, isLoading, images]);

  const handleSwipe = async (dir) => {
    if (!images[currentIndex]) return;
    
    const currentImage = images[currentIndex];
    setDirection(null);
    
    if (dir === 'right') {
      setLikedImages(prev => [currentImage, ...prev].slice(0, 10));
    }
    
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
      
      // Update profile in real-time on laptop if it's not finished
      if (currentIndex % 5 === 0 && currentIndex > 0) {
        const res = await fetch(`${API_BASE}/profile/${userId}`);
        const profileData = await res.json();
        setProfile(profileData);
      }
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
      if (currentIndex >= 30) {
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
    setLikedImages([]);
    
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
    <div className="layout-container min-h-screen bg-[#f8f9fa] text-[#171717] overflow-hidden">
      {/* Background Glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-neutral-200/20 blur-[150px] rounded-full -z-20" />

      {/* Left Panel: Recent Likes (Laptop only) */}
      <aside className="side-panel hidden lg:flex border-r border-neutral-200 p-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-6">Recent Likes</h2>
        <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-2">
          {likedImages.map((img, i) => (
            <div key={`${img.id}-${i}`} className="aspect-[3/4] rounded-xl overflow-hidden border border-neutral-200 animate-in">
              <img src={img.url} className="size-full object-cover" alt="liked" />
            </div>
          ))}
          {likedImages.length === 0 && (
            <div className="col-span-2 py-20 text-center border-2 border-dashed border-neutral-200 rounded-2xl">
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Swipe right to save</p>
            </div>
          )}
        </div>
      </aside>

      {/* Center Panel: Main Discovery */}
      <main className="center-panel flex-1 flex flex-col items-center justify-between py-8 px-4 relative">
        <header className="w-full text-center mb-4">
          <h1 className="text-4xl font-black tracking-tighter m-0">SWAG</h1>
          <p className="text-neutral-500 text-sm">Find your aesthetic</p>
        </header>

        <section className="relative w-full max-w-sm aspect-[3/4] flex items-center justify-center mb-auto mt-auto">
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
              
              {currentIndex + 1 < images.length && (
                <div className="absolute inset-0 -z-10 flex items-center justify-center scale-95 opacity-50">
                  <SwipeCard 
                    key={images[currentIndex + 1].id}
                    image={images[currentIndex + 1]}
                    isTop={false}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="w-full bg-white rounded-3xl shadow-2xl p-8 border border-neutral-100 overflow-y-auto max-h-full animate-in lg:hidden">
               <ProfileView profile={profile} reset={reset} />
            </div>
          )}
        </section>

        {/* Controls - Fixed at bottom of center panel */}
        {!isFinished && (
          <div className="w-full flex flex-col items-center gap-6 mt-8">
            <div className="flex gap-8">
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => handleSwipe('left')}
                  className="size-16 rounded-full bg-white border-2 border-red-500 text-red-500 shadow-lg hover:bg-red-50 transition-all flex items-center justify-center active:scale-95"
                >
                  <X size={28} />
                </button>
                <span className="hidden lg:block text-[10px] font-bold text-neutral-400"><kbd className="kbd">←</kbd> PASS</span>
              </div>
              
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => handleSwipe('right')}
                  className="size-16 rounded-full bg-white border-2 border-green-500 text-green-500 shadow-lg hover:bg-green-50 transition-all flex items-center justify-center active:scale-95"
                >
                  <Heart size={28} />
                </button>
                <span className="hidden lg:block text-[10px] font-bold text-neutral-400">KEEP <kbd className="kbd">→</kbd></span>
              </div>
            </div>
            
            <div className="text-neutral-400 text-[10px] font-bold uppercase tracking-widest">
              Style Discovery: {currentIndex + 1}
            </div>
          </div>
        )}
      </main>

      {/* Right Panel: Style Profile (Laptop only) */}
      <aside className="side-panel hidden lg:flex border-l border-neutral-200 p-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-6">Live Profile</h2>
        <div className="flex-1 overflow-y-auto">
          {profile ? (
            <ProfileView profile={profile} reset={reset} isSide={true} />
          ) : (
            <div className="py-20 text-center border-2 border-dashed border-neutral-200 rounded-2xl">
               <RefreshCw className="w-6 h-6 animate-spin mx-auto text-neutral-200 mb-4" />
               <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Profiling your taste...</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// Sub-component for Profile to keep it clean
function ProfileView({ profile, reset, isSide }) {
  return (
    <div className={`flex flex-col items-center text-center ${isSide ? 'animate-in' : ''}`}>
      {!isSide && (
        <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-6 border border-neutral-100">
          <Trophy className="w-8 h-8 text-neutral-800" />
        </div>
      )}
      <h2 className="text-2xl font-bold mb-2 tracking-tight">Your Style DNA</h2>
      <p className="text-neutral-500 text-xs mb-8">Refined in real-time</p>
      
      <div className="w-full space-y-3 mb-10">
        {profile?.dominant_styles?.map((style, index) => (
          <div key={style} className="flex items-center gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
            <div className="w-8 h-8 flex items-center justify-center bg-white rounded-xl text-xs font-bold border border-neutral-100">
              0{index + 1}
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-sm font-bold capitalize">{style.replace('_', ' ')}</h3>
            </div>
          </div>
        ))}
      </div>

      {profile?.suggested_pieces_to_buy && (
        <div className="w-full text-left mb-10">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-4 px-2">Recommended Pieces</h4>
          <div className="flex flex-wrap gap-2">
            {profile.suggested_pieces_to_buy.slice(0, 6).map((item, i) => (
              <span key={i} className="bg-neutral-100 px-3 py-2 rounded-lg text-[10px] font-medium text-neutral-700 capitalize">
                {item.piece}
              </span>
            ))}
          </div>
        </div>
      )}

      {!isSide && (
        <button 
          onClick={reset}
          className="w-full py-4 bg-[#171717] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all active:scale-[0.98]"
        >
          <RefreshCw className="w-4 h-4" />
          New Session
        </button>
      )}
    </div>
  );
}

export default App;
