import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { routines, routineExercises, exercises } from "@/db/schema";
import type { Prescription } from "./training-prescription";
export async function getRoutinePrescription(
  userId: number,
  routineId: number,
): Promise<Prescription[]> {
  const rows = await db
    .select({
      slot: routineExercises,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      imageUrl: exercises.imageUrl,
    })
    .from(routineExercises)
    .innerJoin(routines, eq(routines.id, routineExercises.routineId))
    .innerJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
    .where(and(eq(routines.userId, userId), eq(routines.id, routineId)))
    .orderBy(asc(routineExercises.position), asc(routineExercises.id));
  return rows.map(({ slot, name, muscleGroup, imageUrl }) => ({
    ...slot,
    slotId: slot.id,
    name,
    muscleGroup,
    imageUrl,
  }));
}
