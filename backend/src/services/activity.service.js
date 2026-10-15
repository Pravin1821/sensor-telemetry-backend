function activityScore(samples) {
  let total = 0;
  for (const { x, y, z } of samples) {
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    total += Math.abs(magnitude - 1000);
  }
  return total / samples.length;
}

module.exports = { activityScore };