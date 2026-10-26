export const URGENCY_WEIGHTS = {
  rendah: 25,
  sedang: 50,
  tinggi: 75,
  kritis: 100,
};

export function calculatePriorityScore(urgency, supportCount = 0) {
  const U = URGENCY_WEIGHTS[urgency];
  if (U === undefined) {
    throw new Error(`Urgensi '${urgency}' tidak valid.`);
  }

  const count = Math.max(0, Number(supportCount) || 0);
  const D = Math.min(100, (count / 20) * 100);
  const score = 0.6 * U + 0.4 * D;
  return Math.round(score * 100) / 100;
}
