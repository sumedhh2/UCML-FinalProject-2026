import React from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const SwipeCard = ({ image, onSwipeLeft, onSwipeRight, isTop, direction }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);

  const handleDragEnd = (event, info) => {
    if (Math.abs(info.offset.x) > 100) {
      if (info.offset.x > 0) {
        onSwipeRight();
      } else {
        onSwipeLeft();
      }
    } else {
      x.set(0);
    }
  };

  if (!isTop) {
    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="size-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-neutral-100">
          <div className="flex-1 relative overflow-hidden">
            <img 
              src={image.url} 
              alt={image.aesthetic} 
              className="size-full object-cover opacity-50"
            />
          </div>
          <div className="p-6 bg-white border-t border-neutral-50">
            <p className="text-neutral-700 text-center font-medium capitalize">
              Explore this {image.aesthetic.replace('_', ' ')} style and build your unique fashion profile.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Define exit animation variants that use the 'custom' direction
  const variants = {
    exit: (customDirection) => {
      // Priority: 1. customDirection (from button), 2. drag direction (x), 3. default right
      const finalDir = customDirection || (x.get() < 0 ? 'left' : 'right');
      return {
        x: finalDir === 'left' ? -500 : 500,
        opacity: 0,
        rotate: finalDir === 'left' ? -30 : 30,
        transition: { duration: 0.3 }
      };
    }
  };

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.05 }}
      variants={variants}
      custom={direction}
      exit="exit"
      className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
    >
      <div className="size-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-neutral-100 relative group">
        <div className="flex-1 relative overflow-visible">
          {/* Placeholder / Loading State */}
          <div className="absolute inset-0 bg-neutral-50 flex items-center justify-center -z-10">
            <Sparkles className="w-12 h-12 text-neutral-200 animate-pulse" />
          </div>
          
          <img 
            src={image.url} 
            alt={image.aesthetic} 
            className="size-full object-cover select-none"
            draggable="false"
          />

          {/* Floating Style Tags */}
          <div className="absolute bottom-20 left-6 flex flex-wrap gap-2 z-10 max-w-[80%]">
            {[image.aesthetic.replace('_', ' '), 'Trending', 'Curated'].map((tag, idx) => (
              <div 
                key={idx} 
                className="bg-white/70 backdrop-blur-md rounded-full py-2 px-4 shadow-sm border border-white/20 whitespace-nowrap"
              >
                <span className="text-[11px] font-semibold text-neutral-800 capitalize tracking-tight">{tag}</span>
              </div>
            ))}
          </div>
          
          {/* Overlay Labels (Swipe feedback) */}
          <motion.div 
            style={{ opacity: useTransform(x, [50, 150], [0, 1]) }}
            className="absolute top-12 left-12 border-4 border-green-500 text-green-500 font-bold text-3xl px-6 py-2 rounded-2xl rotate-[-15deg] pointer-events-none"
          >
            KEEP
          </motion.div>
          <motion.div 
            style={{ opacity: useTransform(x, [-150, -50], [1, 0]) }}
            className="absolute top-12 right-12 border-4 border-red-500 text-red-500 font-bold text-3xl px-6 py-2 rounded-2xl rotate-[15deg] pointer-events-none"
          >
            PASS
          </motion.div>
        </div>

        <div className="p-6 bg-white border-t border-neutral-50">
          <p className="text-neutral-700 text-center font-medium capitalize">
            Explore this {image.aesthetic.replace('_', ' ')} style and build your unique fashion profile.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default SwipeCard;
