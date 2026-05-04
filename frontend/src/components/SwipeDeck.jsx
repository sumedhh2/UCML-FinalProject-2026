import React from 'react';
import { AnimatePresence } from 'framer-motion';
import SwipeCard from './SwipeCard';

/**
 * SwipeDeck
 * Renders the stacked card pair (top interactive card + ghost preview behind it)
 * and a progress counter below.
 */
const SwipeDeck = ({ images, currentIndex, direction, onSwipeLeft, onSwipeRight }) => {
  const currentImage = images[currentIndex];
  const nextImage = images[currentIndex + 1];

  return (
    <div className="relative w-full max-w-sm flex flex-col items-center justify-center">
      {/* Card stack - reverted to stable aspect ratio */}
      <div className="relative w-full aspect-[3/4] max-h-[560px]">
        <AnimatePresence mode="popLayout" custom={direction}>
          {currentImage && (
            <SwipeCard
              key={currentImage.id}
              image={currentImage}
              onSwipeLeft={onSwipeLeft}
              onSwipeRight={onSwipeRight}
              isTop={true}
              direction={direction}
            />
          )}
        </AnimatePresence>

        {/* Ghost card behind the top card */}
        {nextImage && (
          <SwipeCard
            key={nextImage.id}
            image={nextImage}
            isTop={false}
          />
        )}
      </div>

      {/* Progress counter (simplified) */}

    </div>
  );
};

export default SwipeDeck;
