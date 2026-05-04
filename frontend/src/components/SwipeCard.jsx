import React from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

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
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none scale-95 opacity-50">
        <div className="size-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-neutral-100">
          <div className="flex-1 relative overflow-hidden">
            <img 
              src={image.url} 
              alt={image.aesthetic} 
              className="size-full object-cover object-top"
            />
          </div>
        </div>
      </div>
    );
  }

  const variants = {
    exit: (customDirection) => {
      const finalDir = customDirection || (x.get() < 0 ? 'left' : 'right');
      return {
        x: finalDir === 'left' ? -1000 : 1000,
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
        <div className="flex-1 relative overflow-hidden">
            <img 
              src={image.url} 
              alt={image.aesthetic} 
              className="size-full object-cover object-top select-none"
              draggable="false"
            />
          
          {/* Overlay Labels (Swipe feedback) */}
          <motion.div 
            style={{ opacity: useTransform(x, [50, 150], [0, 1]) }}
            className="absolute top-12 left-12 border-8 border-green-500 text-green-500 font-black text-5xl px-8 py-3 rounded-2xl rotate-[-15deg] pointer-events-none"
          >
            LIKE
          </motion.div>
          <motion.div 
            style={{ opacity: useTransform(x, [-150, -50], [1, 0]) }}
            className="absolute top-12 right-12 border-8 border-red-500 text-red-500 font-black text-5xl px-8 py-3 rounded-2xl rotate-[15deg] pointer-events-none"
          >
            NOPE
          </motion.div>
        </div>

      </div>
    </motion.div>
  );
};

export default SwipeCard;
