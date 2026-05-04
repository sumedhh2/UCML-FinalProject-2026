import React from 'react';
import { ShoppingBag, Zap, Layers, Shuffle } from 'lucide-react';

const SLOT_META = {
  statement:  { label: 'Statement Piece',  Icon: Zap,     color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  basic:      { label: 'Basic Essential',  Icon: Layers,  color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-200'   },
  wild_card:  { label: 'Wild Card',   Icon: Shuffle, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  // Backward compatibility
  hero:       { label: 'Statement Piece',  Icon: Zap,     color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  gap_filler: { label: 'Basic Essential',  Icon: Layers,  color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-200'   },
};

/**
 * WardrobeEssentials
 * Renders cluster-anchored wardrobe recommendations from the user's profile.
 * Each recommendation is anchored to a specific style cluster (never blended).
 */
const WardrobeEssentials = ({ pieces }) => (
  <div className="bg-white rounded-[2rem] shadow-2xl p-8 md:p-10 border border-slate-100">
    {/* Header */}
    <div className="flex items-center gap-3 mb-5">
      <ShoppingBag className="w-5 h-5 text-slate-900" />
      <h2 className="text-xl font-black text-slate-900 tracking-tight">Wardrobe Essentials</h2>
    </div>

    <p className="text-slate-400 text-sm mb-6 font-medium">
      Your 5-piece curated capsule — anchored to your distinct style clusters.
    </p>

    {/* Pieces list */}
    <div className="space-y-3">
      {pieces?.map((item, index) => {
        const meta = SLOT_META[item.slot] || SLOT_META.hero;
        const { label, Icon, color, bg, border } = meta;
        const styleTag = item.style?.replace(/_/g, ' ');
        return (
          <div
            key={`${item.slot}-${index}`}
            className={`p-5 border-2 ${border} ${bg} rounded-3xl transition-all group`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className={`text-xs font-black uppercase tracking-widest ${color}`}>{label}</span>
              {styleTag && (
                <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-white/80 px-2 py-0.5 rounded-full border border-slate-100">
                  {styleTag}
                </span>
              )}
            </div>
            <h3 className="text-base font-black text-slate-900 group-hover:text-slate-700 transition-colors capitalize leading-tight">
              {item.description}
            </h3>
            {item.category && (
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                {item.category}
              </p>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

export default WardrobeEssentials;
