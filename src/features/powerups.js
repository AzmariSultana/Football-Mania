// One-slot power-ups, earned (never random pick-ups) from streaks and boss wins.
// Activated while aiming and spent on that kick.

export const POWERUPS = {
  laser: { id: 'laser', icon: '🎯', name: 'Laser Aim', desc: 'Shows the full flight path' },
  ice: { id: 'ice', icon: '🧊', name: 'Ice Keeper', desc: 'The keeper reacts late and guesses blind' },
  mini: { id: 'mini', icon: '🧱', name: 'Mini Wall', desc: 'The wall shrinks for one kick' },
  golden: { id: 'golden', icon: '🪙', name: 'Golden Ball', desc: 'Double points if it goes in' },
};

export const POWERUP_IDS = Object.keys(POWERUPS);

// Streak lengths that award a power-up (if the slot is empty).
export const POWERUP_STREAKS = [3, 6, 9, 12];
