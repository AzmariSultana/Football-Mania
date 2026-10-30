// Boss keepers: one special kick every few goals (and twice in the Daily Challenge).
// Each changes a different part of the keeper or wall, so each needs a different shot.

export const BOSSES = [
  {
    id: 'octopus',
    name: 'The Octopus',
    desc: 'Enormous reach, slow to react. Make him stretch late.',
    shirt: 0x7e3ff2,
    scale: 1.3,
    reactionAdd: 0.12,
    readBonus: 0.15,
    wall: 4,
  },
  {
    id: 'gambler',
    name: 'The Gambler',
    desc: 'Always dives early to a corner. Keep your nerve.',
    shirt: 0xff2d55,
    gambler: true,
    wall: 3,
  },
  {
    id: 'fortress',
    name: 'The Fortress',
    desc: 'A six-man wall in front of a sharp keeper.',
    shirt: 0x8d99ae,
    readBonus: 0.2,
    wall: 6,
  },
  {
    id: 'mirror',
    name: 'The Mirror',
    desc: 'Has studied your favourite spot. Do something new.',
    shirt: 0x00e5ff,
    mirror: true,
    wall: 4,
  },
];
