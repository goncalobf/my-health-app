export function dailyExpenditure(synced: number | null, logged: number | null) {
  if (synced !== null) return { totalCalories: synced, source: "Garmin sync" } as const;
  if (logged !== null) return { totalCalories: logged, source: "Manual log" } as const;
  return null;
}

export function dailyExpenditureTrend(
  synced: { date: string; caloriesTotal: number | null }[],
  logged: { day: string; totalCalories: number }[],
) {
  const byDate = new Map(synced.map((row) => [row.date, row.caloriesTotal]));
  const byDay = new Map(logged.map((row) => [row.day, row.totalCalories]));
  const dates = [...new Set([...byDay.keys(), ...byDate.keys()])].sort();

  return dates.flatMap((day) => {
    const expenditure = dailyExpenditure(byDate.get(day) ?? null, byDay.get(day) ?? null);
    return expenditure ? [{ day, ...expenditure }] : [];
  });
}
