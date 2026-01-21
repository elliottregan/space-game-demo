export const EVENT_TIMING = {
  minSolsBetween: 30,
  maxSolsBetween: 90,
  earlyGameCap: 100,

  getEventChance(currentSol: number): number {
    if (currentSol < 50) return 0.02;
    if (currentSol < 200) return 0.05;
    if (currentSol < 500) return 0.08;
    return 0.12;
  },
};
