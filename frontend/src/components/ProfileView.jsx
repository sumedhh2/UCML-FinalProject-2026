import React from 'react';
import { ArrowLeft } from 'lucide-react';
import AestheticPillars from './AestheticPillars';
import WardrobeEssentials from './WardrobeEssentials';

/** Maps backend style labels to human-readable persona names. */
const getPersona = (styles) => {
  if (!styles?.length) return 'Style Explorer';
  const primary = styles[0].toLowerCase();
  if (primary.includes('minimal')) return 'Minimalist Architect';
  if (primary.includes('street')) return 'Urban Visionary';
  if (primary.includes('vintage') || primary.includes('retro')) return 'Archive Curator';
  if (primary.includes('gorp')) return 'Outdoor Aestheticist';
  if (primary.includes('chic')) return 'Modern Sophisticate';
  return `${styles[0].replace(/_/g, ' ')} Specialist`;
};

/**
 * ProfileView
 * Full-page aesthetic report shown after the user completes their swipe session.
 * Composes StyleIdentity, AestheticPillars, and WardrobeEssentials panels.
 */
const ProfileView = ({ profile, onReset }) => {
  if (!profile) return null;

  const persona = getPersona(profile.dominant_styles);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 md:p-8 lg:p-12">
        {/* Back button */}
        <button
          onClick={onReset}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-900 mb-8
                     transition-colors font-bold text-xs uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          Start New Discovery
        </button>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* ── Left column ─────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Identity card */}
            <div className="bg-white rounded-[2rem] shadow-2xl p-8 md:p-10 border border-slate-100">
              <span className="inline-block px-3 py-1 mb-3 rounded-full bg-slate-100
                               text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Your Style Identity
              </span>
              <h1 className="text-4xl md:text-5xl text-slate-900 font-black tracking-tight
                             leading-none mb-3">
                {persona}
              </h1>
              <p className="text-slate-400 text-base italic">
                A sophisticated blend refined through{' '}
                <strong className="text-slate-700">{profile.total_liked}</strong> curated interactions.
              </p>
            </div>

            {/* Pillars + vibes */}
            <AestheticPillars
              dominantStyles={profile.dominant_styles}
              topVibes={profile.top_vibes}
            />
          </div>

          {/* ── Right column ────────────────────────────────────── */}
          <div className="space-y-6">
            <WardrobeEssentials pieces={profile.wardrobe_recommendations} />

            <button
              onClick={onReset}
              className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black
                         text-sm uppercase tracking-[0.2em] hover:bg-slate-800
                         transition-all shadow-xl active:scale-[0.98]"
            >
              Start New Discovery
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
