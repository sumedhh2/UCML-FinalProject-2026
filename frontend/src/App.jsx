import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import SwipeCard from './components/SwipeCard';
import LikedHistory from './components/LikedHistory';
import { Heart, X, RefreshCw, TrendingUp, ShoppingBag, ArrowLeft, Star, Sparkles } from 'lucide-react';

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
      setLikedImages(prev => [...prev, currentImage]);
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
      <div className="w-full min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className={`w-full min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col md:flex-row overflow-hidden`}>
      {isFinished ? (
        <ProfileView profile={profile} reset={reset} />
      ) : (
        <>
          {/* Main Discovery Panel */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-8 min-h-0 relative">
            <div className="mb-4 md:mb-6 flex-shrink-0 text-center">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter">SWAG</h1>
              <p className="text-slate-500 mt-1 md:mt-2 text-sm md:text-base">Discover your aesthetic, one swipe at a time</p>
            </div>

            <div className="relative w-full max-w-sm flex-1 flex flex-col min-h-0 justify-center mb-12">
               <div className="relative flex-1 min-h-0 aspect-[3/4] max-h-[600px]">
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
                  <SwipeCard 
                    key={images[currentIndex + 1].id}
                    image={images[currentIndex + 1]}
                    isTop={false}
                  />
                )}
               </div>

              <div className="flex gap-4 md:gap-6 justify-center mt-8 flex-shrink-0">
                <button
                  onClick={() => handleSwipe('left')}
                  className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white shadow-xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 border border-slate-100"
                >
                  <X className="w-6 h-6 md:w-8 md:h-8 text-red-500" />
                </button>
                <button
                  onClick={() => handleSwipe('right')}
                  className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white shadow-xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 border border-slate-100"
                >
                  <Heart className="w-6 h-6 md:w-8 md:h-8 text-green-500" />
                </button>
              </div>

              <div className="text-center mt-6">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{currentIndex + 1} / 30 Interactions</p>
              </div>
            </div>
          </div>

          {/* Sidebar Panel: Liked History */}
          <LikedHistory outfits={likedImages} />
        </>
      )}
    </div>
  );
}

function ProfileView({ profile, reset }) {
  const getPersona = (styles) => {
    if (!styles || styles.length === 0) return "Style Explorer";
    const primary = styles[0].toLowerCase();
    if (primary.includes('minimal')) return "Minimalist Architect";
    if (primary.includes('street')) return "Urban Visionary";
    if (primary.includes('vintage') || primary.includes('retro')) return "Archive Curator";
    if (primary.includes('gorp')) return "Outdoor Aestheticist";
    if (primary.includes('chic')) return "Modern Sophisticate";
    return `${styles[0]} Specialist`;
  };

  const persona = getPersona(profile?.dominant_styles);

  if (!profile) return null;

  return (
    <div className="size-full bg-gradient-to-br from-slate-50 to-slate-100 overflow-y-auto min-h-screen">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <button
          onClick={reset}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-8 transition-colors font-bold text-sm uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Swiping
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-8">
            <div className="bg-white rounded-[2rem] shadow-2xl p-10 md:p-12 border border-slate-100">
              <div className="mb-2">
                <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Your Style Identity
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl text-slate-900 font-black tracking-tight leading-none mb-4">{persona}</h1>
              <p className="text-slate-500 text-lg italic">A sophisticated blend refined through {profile.total_liked} curated interactions.</p>
            </div>

            <div className="bg-white rounded-[2rem] shadow-2xl p-10 md:p-12 border border-slate-100">
              <div className="flex items-center gap-3 mb-8">
                <TrendingUp className="w-6 h-6 text-slate-900" />
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Core Aesthetic Pillars</h2>
              </div>

              <div className="space-y-8">
                {profile.dominant_styles?.map((style, index) => (
                  <div key={style} className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-lg">
                          0{index + 1}
                        </div>
                        <h3 className="text-xl font-black text-slate-900 capitalize tracking-tight">{style.replace('_', ' ')}</h3>
                      </div>
                      <span className="text-2xl font-black text-slate-900">{100 - index * 15}%</span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-3 mb-2">
                      <div
                        className="bg-gradient-to-r from-slate-700 to-slate-900 h-3 rounded-full transition-all duration-1000"
                        style={{ width: `${100 - index * 15}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Vibes Section */}
              <div className="mt-12 pt-8 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="w-5 h-5 text-slate-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Visual Moods</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.top_vibes?.map((v) => (
                    <div key={v.vibe} className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 capitalize">
                      {v.vibe} <span className="text-slate-300 ml-1 font-mono">{v.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white rounded-[2rem] shadow-2xl p-10 md:p-12 border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <ShoppingBag className="w-6 h-6 text-slate-900" />
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Wardrobe Essentials</h2>
              </div>

              <p className="text-slate-500 mb-8 font-medium">
                Curated foundations that match your unique style DNA.
              </p>

              <div className="space-y-4">
                {profile.suggested_pieces_to_buy?.map((item, index) => (
                  <div
                    key={index}
                    className="p-6 border-2 border-slate-50 rounded-3xl hover:border-slate-200 transition-all group bg-slate-50/30"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-black text-slate-900 group-hover:text-slate-700 transition-colors capitalize">
                        {item.piece}
                      </h3>
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, starI) => (
                          <Star key={starI} size={10} fill={starI < Math.ceil(item.count / 2) ? "currentColor" : "none"} className={starI < Math.ceil(item.count / 2) ? "text-yellow-400" : "text-slate-200"} />
                        ))}
                      </div>
                    </div>
                    <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Essential Foundational Piece</p>
                  </div>
                ))}
              </div>
            </div>
            
            <button 
              onClick={reset}
              className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl active:scale-[0.98]"
            >
              Start New Discovery
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
