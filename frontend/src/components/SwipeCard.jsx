import React from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const SwipeCard = ({ image, onSwipeLeft, onSwipeRight, isTop }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  
  const handleDragEnd = (event, info) => {
    if (info.offset.x > 100) {
      onSwipeRight();
    } else if (info.offset.x < -100) {
      onSwipeLeft();
    }
  };

  if (!isTop) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl bg-gray-900 border border-white/10">
          <img 
            src={image.url} 
            alt={image.aesthetic} 
            className="w-full h-full object-cover opacity-50 blur-[2px]"
          />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.05 }}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ x: x.get() < 0 ? -500 : 500, opacity: 0, transition: { duration: 0.3 } }}
      className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
    >
      <div className="w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl bg-gray-900 border border-white/20 relative group">
        {/* Placeholder / Loading State */}
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center -z-10">
          <Sparkles className="w-12 h-12 text-white/10 animate-pulse" />
        </div>
        
        <img 
          src={image.url} 
          alt={image.aesthetic} 
          className="w-full h-full object-cover select-none"
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/400x600?text=Fashion+Discovery';
          }}
        />
        
        {/* Overlay Labels */}
        <motion.div 
          style={{ opacity: useTransform(x, [50, 150], [0, 1]) }}
          className="absolute top-8 left-8 border-4 border-green-500 text-green-500 font-bold text-4xl px-4 py-2 rounded-xl rotate-[-15deg] pointer-events-none"
        >
          KEEP
        </motion.div>
        <motion.div 
          style={{ opacity: useTransform(x, [-150, -50], [1, 0]) }}
          className="absolute top-8 right-8 border-4 border-red-500 text-red-500 font-bold text-4xl px-4 py-2 rounded-xl rotate-[15deg] pointer-events-none"
        >
          PASS
        </motion.div>

        {/* Info Overlay */}
        <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <p className="text-white/60 text-sm font-medium tracking-widest uppercase mb-1">Aesthetic</p>
          <h2 className="text-white text-2xl font-bold capitalize">{image.aesthetic.replace('_', ' ')}</h2>
        </div>
      </div>
    </motion.div>
  );
};

export default SwipeCard;
