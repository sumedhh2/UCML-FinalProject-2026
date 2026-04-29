import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import SwipeCard from './components/SwipeCard';
import { Heart, X, RefreshCw, Trophy, Sparkles, ShoppingBag, Fingerprint, Star } from 'lucide-react';

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

  // Lock/Unlock body scroll
  useEffect(() => {
    if (!isFinished) {
      document.body.classList.add('locked');
    } else {
      document.body.classList.remove('locked');
    }
    return () => document.body.classList.remove('locked');
  }, [isFinished]);

  if (isLoading) {
    return (
      <div className="size-full min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className={`layout-container ${!isFinished ? 'locked' : ''} bg-[#f8f9fa] text-[#171717]`}>
      {/* Background Glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-neutral-200/20 blur-[150px] rounded-full -z-20" />

      {/* Left Panel: Recent Likes (Laptop only) */}
      {!isFinished && (
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
      )}

      {/* Center Panel: Main Discovery */}
      <main className={`center-panel flex-1 flex flex-col items-center py-8 px-4 relative ${isFinished ? 'min-h-screen justify-start' : 'justify-between'}`}>
        {!isFinished && (
          <header className="w-full text-center mb-4">
            <h1 className="text-4xl font-black tracking-tighter m-0">SWAG</h1>
            <p className="text-neutral-500 text-sm">Find your aesthetic</p>
          </header>
        )}

        {isFinished ? (
          <div className="w-full max-w-[1400px] mx-auto py-12 animate-in">
            <div className="flex items-center justify-between mb-16 px-4">
               <div className="flex flex-col">
                 <h1 className="text-6xl font-black tracking-tighter m-0">SWAG</h1>
                 <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest">Aesthetic Intelligence Report</p>
               </div>
               <button 
                onClick={reset}
                className="px-6 py-3 bg-white border border-neutral-200 rounded-full flex items-center gap-2 hover:bg-neutral-50 transition-all active:scale-95 shadow-sm font-bold text-xs"
               >
                 <RefreshCw size={14} /> New Discovery
               </button>
            </div>
            
            <ProfileView profile={profile} reset={reset} isFullWidth={true} />
          </div>
        ) : (
          <section className="relative w-full max-w-sm flex items-center justify-center mb-auto mt-auto aspect-[3/4]">
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
          </section>
        )}

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
      {!isFinished && (
        <aside className="side-panel hidden lg:flex border-l border-neutral-200 p-6 flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400">Live Profile</h2>
            {profile && (
              <div className="flex items-center gap-1.5">
                <div className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter">Live</span>
              </div>
            )}
          </div>
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
      )}
    </div>
  );
}

// Sub-component for Profile to keep it clean
function ProfileView({ profile, reset, isSide, isFullWidth }) {
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

  if (isSide) {
    return (
      <div className="animate-in px-2 w-full space-y-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-4 flex items-center justify-center gap-2">
          <Star size={12} fill="currentColor" /> Core Aesthetics
        </h3>
        <div className="space-y-3">
          {profile?.dominant_styles?.map((style, index) => (
            <div key={style} className="bg-white border border-neutral-100 p-4 rounded-2xl shadow-sm text-center">
              <p className="text-[9px] font-bold text-neutral-300 uppercase mb-1">Pillar 0{index + 1}</p>
              <h3 className="text-xs font-black capitalize tracking-tight text-neutral-800">{style.replace('_', ' ')}</h3>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isFullWidth) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Visual Moods (Moodboard feel) */}
        <div className="lg:col-span-3 space-y-8 animate-in" style={{ animationDelay: '0.1s' }}>
          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-8 flex items-center gap-2">
              <Sparkles size={12} fill="currentColor" /> Visual Moods
            </h3>
            <div className="space-y-4">
              {profile?.top_vibes?.map((v, i) => (
                <div key={v.vibe} className="flex items-center justify-between group">
                  <span className="text-sm font-bold capitalize text-neutral-800 group-hover:translate-x-1 transition-transform">{v.vibe}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-neutral-50 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-900 rounded-full" style={{ width: `${(v.count / profile.total_liked) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400">{v.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-neutral-900 p-8 rounded-[2.5rem] text-white shadow-xl">
             <Trophy size={24} className="text-yellow-400 mb-4" />
             <h4 className="text-sm font-black mb-2 tracking-tight">Curator Status</h4>
             <p className="text-[10px] text-neutral-400 leading-relaxed uppercase tracking-widest font-bold">
               Refined through {profile?.total_liked} high-fidelity interactions.
             </p>
          </div>
        </div>

        {/* Center: Identity + Styles */}
        <div className="lg:col-span-6 space-y-8 animate-in" style={{ animationDelay: '0.2s' }}>
          <div className="bg-white p-10 sm:p-16 rounded-[4rem] border border-neutral-100 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
               <Fingerprint size={200} />
            </div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <span className="inline-block px-3 py-1 rounded-full bg-neutral-100 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-6">
                Aesthetic DNA
              </span>
              <h2 className="text-5xl font-black mb-4 tracking-tighter leading-none">{persona}</h2>
              <p className="text-neutral-500 text-sm italic mb-12 max-w-xs mx-auto">
                A sophisticated blend of textures, silhouettes, and cultural references.
              </p>

              <div className="w-full space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-6 text-left px-4 flex items-center gap-2">
                  <Star size={12} fill="currentColor" /> Core Aesthetic Pillars
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {profile?.dominant_styles?.map((style, index) => (
                    <div key={style} className="bg-neutral-50 p-6 rounded-[2rem] border border-neutral-100 text-left group hover:bg-neutral-900 hover:text-white transition-all">
                      <div className="text-[10px] font-bold text-neutral-300 group-hover:text-neutral-600 mb-2">PILLAR 0{index + 1}</div>
                      <h3 className="text-lg font-black capitalize tracking-tight">{style.replace('_', ' ')}</h3>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="text-center pt-8">
             <button 
                onClick={reset}
                className="px-12 py-6 bg-neutral-900 text-white rounded-[2.5rem] font-black text-sm uppercase tracking-widest hover:scale-105 transition-all active:scale-95 shadow-2xl"
              >
                Start New Discovery
              </button>
          </div>
        </div>

        {/* Right: Recommended Items */}
        <div className="lg:col-span-3 space-y-8 animate-in" style={{ animationDelay: '0.3s' }}>
          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-8 flex items-center gap-2">
              <ShoppingBag size={12} fill="currentColor" /> Wardrobe Essentials
            </h3>
            <div className="space-y-4">
              {profile?.suggested_pieces_to_buy?.slice(0, 8).map((item, i) => (
                <div key={i} className="p-5 bg-neutral-50 rounded-2xl border border-neutral-100 hover:border-neutral-200 transition-all">
                   <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-black text-neutral-800 capitalize leading-tight">{item.piece}</span>
                     <span className="text-[9px] font-bold px-2 py-0.5 bg-white rounded-full border border-neutral-100 uppercase text-neutral-400">Essential</span>
                   </div>
                   <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, starI) => (
                        <Star key={starI} size={7} fill={starI < Math.ceil(item.count / 2) ? "currentColor" : "none"} className={starI < Math.ceil(item.count / 2) ? "text-yellow-400" : "text-neutral-200"} />
                      ))}
                      <span className="text-[8px] font-bold text-neutral-400 ml-1 uppercase">Match</span>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center text-center ${isSide ? 'animate-in px-2' : 'max-w-2xl mx-auto w-full'}`}>
      {!isSide && (
        <div className="relative mb-6">
          <div className="w-24 h-24 bg-gradient-to-tr from-neutral-900 to-neutral-600 rounded-full flex items-center justify-center shadow-xl border-4 border-white">
            <Fingerprint className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-yellow-400 p-2 rounded-full shadow-lg border-2 border-white">
            <Trophy size={16} className="text-neutral-900" />
          </div>
        </div>
      )}

      <div className="mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-neutral-100 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2">
          Aesthetic Identity
        </span>
        <h2 className={isSide ? "text-xl font-black mb-1 tracking-tighter" : "text-3xl font-black mb-2 tracking-tighter"}>{persona}</h2>
        <p className="text-neutral-500 text-[10px] sm:text-sm italic">Based on {profile?.total_liked || 0} curated selections</p>
      </div>
      
      {/* Dominant Styles */}
      <div className={isSide ? "w-full mb-6" : "w-full mb-10"}>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4 text-left px-2 flex items-center gap-2">
          <Star size={12} fill="currentColor" /> Core Aesthetics
        </h3>
        <div className={`grid gap-3 ${isSide ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
          {profile?.dominant_styles?.map((style, index) => (
            <div key={style} className={`group relative overflow-hidden bg-white rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md transition-all text-left ${isSide ? 'p-4' : 'p-5'}`}>
              <div className="text-[10px] font-bold text-neutral-300 mb-1">0{index + 1}</div>
              <h3 className="text-sm font-black capitalize tracking-tight">{style.replace('_', ' ')}</h3>
              <div className="mt-4 h-1 w-full bg-neutral-50 rounded-full overflow-hidden">
                <div className="h-full bg-neutral-900 rounded-full" style={{ width: `${100 - index * 20}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vibe Cloud */}
      {profile?.top_vibes && (
        <div className={isSide ? "w-full mb-6" : "w-full mb-10"}>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4 text-left px-2 flex items-center gap-2">
            <Sparkles size={12} fill="currentColor" /> Visual Moods
          </h3>
          <div className="flex flex-wrap gap-1.5 justify-start px-2">
            {profile.top_vibes.map((v, i) => (
              <div key={v.vibe} className={`flex items-center gap-1.5 bg-neutral-50 border border-neutral-100 rounded-2xl hover:bg-white hover:shadow-sm transition-all cursor-default ${isSide ? 'px-3 py-1.5' : 'px-4 py-2'}`}>
                <span className={isSide ? "text-[10px] font-bold capitalize text-neutral-800" : "text-xs font-bold capitalize text-neutral-800"}>{v.vibe}</span>
                <span className="text-[9px] text-neutral-400 font-mono">{v.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Pieces */}
      {profile?.suggested_pieces_to_buy && (
        <div className={isSide ? "w-full mb-8" : "w-full mb-12"}>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4 text-left px-2 flex items-center gap-2">
            <ShoppingBag size={12} fill="currentColor" /> Recommended Foundations
          </h3>
          <div className={`grid gap-3 ${isSide ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {profile.suggested_pieces_to_buy.slice(0, 6).map((item, i) => (
              <div key={i} className={`flex flex-col items-start bg-white border border-neutral-100 rounded-2xl shadow-sm hover:border-neutral-200 transition-all ${isSide ? 'p-3' : 'p-4'}`}>
                <span className="text-[11px] font-bold text-neutral-800 capitalize mb-1 leading-tight">{item.piece}</span>
                <div className="flex items-center gap-1">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, starI) => (
                      <Star key={starI} size={7} fill={starI < Math.ceil(item.count / 2) ? "currentColor" : "none"} className={starI < Math.ceil(item.count / 2) ? "text-yellow-400" : "text-neutral-200"} />
                    ))}
                  </div>
                  <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-tighter">Match</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isSide && (
        <div className="flex flex-col gap-4 w-full">
          <button 
            onClick={reset}
            className="w-full py-5 bg-[#171717] text-white rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-neutral-800 transition-all active:scale-[0.98] shadow-xl"
          >
            <RefreshCw className="w-4 h-4" />
            Start New Discovery
          </button>
          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
            Profile saved to your digital wardrobe
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
