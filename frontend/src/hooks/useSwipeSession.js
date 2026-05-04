import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';
const MAX_SWIPES = 30;

const formatImages = (recommendations) =>
  recommendations.map((img) => ({
    id: img.image_id,
    url: `${API_BASE}${img.image_url}`,
    aesthetic: img.style_label,
  }));

export function useSwipeSession() {
  const [userId, setUserId] = useState(null);
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [profile, setProfile] = useState(null);
  const [likedImages, setLikedImages] = useState([]);
  const [fetchCount, setFetchCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // ── Adaptive Batch Size Logic ─────────────────────────────────────────────
  const getNextBatchSize = (count) => {
    if (count === 0) return 6;  // Start small to get user moving
    if (count === 1) return 10; // Ramp up
    if (count === 2) return 15; // Getting more data
    return 20;                  // Steady state
  };

  // ── Profile Readiness Logic ───────────────────────────────────────────────
  // We consider the profile "ready" after 12 likes.
  const LIKES_THRESHOLD = 12;
  const profileReadiness = Math.min((likedImages.length / LIKES_THRESHOLD) * 100, 100);
  const isProfileStable = likedImages.length >= LIKES_THRESHOLD;

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    initSession();
  }, []);

  const initSession = async () => {
    try {
      const { user_id } = await fetch(`${API_BASE}/users/create`, {
        method: 'POST',
      }).then((r) => r.json());

      setUserId(user_id);

      const batchSize = getNextBatchSize(0);
      const { recommendations } = await fetch(
        `${API_BASE}/recommendations/${user_id}?batch_size=${batchSize}`
      ).then((r) => r.json());

      if (recommendations && recommendations.length > 0) {
        setImages(formatImages(recommendations));
        setFetchCount(1);
      } else {
        setHasMore(false);
      }
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to initialise session:', err);
    }
  };

  // ── Fetch more cards ───────────────────────────────────────────────────────
  const fetchMoreImages = async (uid) => {
    if (!hasMore) return;
    try {
      const batchSize = getNextBatchSize(fetchCount);
      const { recommendations } = await fetch(
        `${API_BASE}/recommendations/${uid}?batch_size=${batchSize}`
      ).then((r) => r.json());

      if (!recommendations || recommendations.length === 0) {
        setHasMore(false);
        return;
      }
      setImages((prev) => [...prev, ...formatImages(recommendations)]);
      setFetchCount((prev) => prev + 1);
    } catch (err) {
      console.error('Failed to fetch more images:', err);
    }
  };

  // ── Finish & fetch final profile ───────────────────────────────────────────
  const finishSession = async (uid) => {
    try {
      const profileData = await fetch(`${API_BASE}/profile/${uid}`).then((r) =>
        r.json()
      );
      setProfile(profileData);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
    setIsFinished(true);
  };

  // ── Log interaction + refresh live profile every 5 swipes ─────────────────
  const logInteraction = async (uid, imageId, liked, index) => {
    try {
      fetch(`${API_BASE}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid, image_id: imageId, liked }),
      });

      // Update local liked list immediately for UI feedback
      if (liked) {
        // We find the image in our local state to add it to likedImages
        const img = images.find(i => i.id === imageId);
        if (img) setLikedImages(prev => [...prev, img]);
      }

      // Refresh background profile periodically
      if (index % 5 === 0 && index > 0) {
        const profileData = await fetch(`${API_BASE}/profile/${uid}`).then(
          (r) => r.json()
        );
        setProfile(profileData);
      }
    } catch (err) {
      console.error('Failed to log interaction:', err);
    }
  };

  // ── Main swipe handler ─────────────────────────────────────────────────────
  const handleSwipe = async (dir) => {
    if (!images[currentIndex]) return;

    const currentImage = images[currentIndex];
    const isLiked = dir === 'right';
    
    setDirection(null);

    // Log the interaction
    await logInteraction(userId, currentImage.id, isLiked, currentIndex);

    setTimeout(() => {
      setDirection(dir);

      // Pre-fetch logic
      if (currentIndex === images.length - 3 && hasMore) {
        fetchMoreImages(userId);
      }

      // Transition to next card
      if (currentIndex < images.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Just increment and the UI will show 'end of deck'
        setCurrentIndex((prev) => prev + 1);
      }
    }, 10);
  };

  // ── Reset / start new session ──────────────────────────────────────────────
  const reset = async () => {
    setIsLoading(true);
    setCurrentIndex(0);
    setIsFinished(false);
    setProfile(null);
    setLikedImages([]);
    setDirection(null);
    setFetchCount(0);
    setHasMore(true);
    await initSession();
  };

  return {
    // state
    images,
    currentIndex,
    direction,
    isLoading,
    isFinished,
    profile,
    likedImages,
    maxSwipes: MAX_SWIPES,
    profileReadiness,
    isProfileStable,
    hasMore,
    // actions
    handleSwipe,
    finishSession: () => finishSession(userId),
    reset,
  };
}

