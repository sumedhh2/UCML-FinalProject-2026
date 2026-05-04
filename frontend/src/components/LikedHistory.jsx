import React from 'react';
import { Heart } from 'lucide-react';

const LikedHistory = ({ outfits }) => {
  return (
    <div className="w-full md:w-80 lg:w-96 bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col max-h-64 md:max-h-full">
      <div className="p-4 md:p-6 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 md:w-5 md:h-5 text-green-500 fill-green-500" />
          <h2 className="text-lg md:text-xl text-slate-900 font-medium">Liked Outfits</h2>
          <span className="ml-auto text-xs md:text-sm text-slate-500">{outfits.length}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-4 min-h-0">
        {outfits.length === 0 ? (
          <div className="text-center py-8 md:py-12">
            <Heart className="w-8 h-8 md:w-12 md:h-12 text-slate-300 mx-auto mb-2 md:mb-3" />
            <p className="text-slate-400 text-sm md:text-base">No liked outfits yet</p>
            <p className="text-slate-400 text-xs md:text-sm mt-1">Start swiping right!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            {outfits.map((outfit, index) => (
              <div
                key={`${outfit.id}-${index}`}
                className="relative aspect-[3/4] rounded-lg md:rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow group cursor-pointer"
              >
                <img
                  src={outfit.url}
                  alt={outfit.aesthetic}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 md:p-3">
                  <Heart className="w-3 h-3 md:w-4 md:h-4 text-white fill-white" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LikedHistory;
