import React from 'react';
import { TrendingUp, Sparkles } from 'lucide-react';

/**
 * AestheticPillars
 * Renders the numbered progress-bar breakdown of dominant styles
 * and the "Visual Moods" vibe tag cloud below.
 */
const AestheticPillars = ({ dominantStyles, topVibes }) => (
  <div className="bg-white rounded-[2rem] shadow-2xl p-8 md:p-10 border border-slate-100">
    {/* Header */}
    <div className="flex items-center gap-3 mb-8">
      <TrendingUp className="w-5 h-5 text-slate-900" />
      <h2 className="text-xl font-black text-slate-900 tracking-tight">Core Aesthetic Pillars</h2>
    </div>

    {/* Progress bars */}
    <div className="space-y-7">
      {dominantStyles?.map((style, index) => {
        return (
          <div key={style}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                  0{index + 1}
                </div>
                <h3 className="text-base font-black text-slate-900 capitalize tracking-tight">
                  {style.replace(/_/g, ' ')}
                </h3>
              </div>
            </div>
          </div>
        );
      })}
    </div>

    {/* Visual Moods */}
    {topVibes?.length > 0 && (
      <div className="mt-10 pt-8 border-t border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-slate-400" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Visual Moods
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {topVibes.map((v) => (
            <span
              key={v.vibe}
              className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 capitalize"
            >
              {v.vibe}{' '}
              <span className="text-slate-300 font-mono">{v.count}</span>
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default AestheticPillars;
