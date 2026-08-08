import { describe, expect, it } from "vitest";
import { defaultExerciseQuery, type Exercise } from "../domain/exercise";
import { InMemoryExerciseRepository } from "./InMemoryExerciseRepository";

const seed: Exercise[] = [
  {
    id: "starter",
    name: "Back Squat",
    normalizedName: "back squat",
    primaryMuscleCode: "quadriceps",
    secondaryMuscleCodes: ["glutes"],
    equipmentCode: "barbell",
    description: "",
    source: "starter",
    archivedAt: null,
    version: 1,
  },
  {
    id: "custom",
    name: "Cable Curl",
    normalizedName: "cable curl",
    primaryMuscleCode: "biceps",
    secondaryMuscleCodes: [],
    equipmentCode: "cable",
    description: "",
    source: "custom",
    archivedAt: null,
    version: 1,
  },
];

describe("InMemoryExerciseRepository", () => {
  it("creates and edits a custom exercise", async () => {
    const repository = new InMemoryExerciseRepository(seed, 0);
    const created = await repository.create({
      name: "Dumbbell Row",
      primaryMuscleCode: "back",
      secondaryMuscleCodes: ["biceps"],
      equipmentCode: "dumbbell",
      description: "Unilateral row",
    });

    const updated = await repository.update(created.id, {
      name: "One-arm Dumbbell Row",
      primaryMuscleCode: "back",
      secondaryMuscleCodes: ["biceps"],
      equipmentCode: "dumbbell",
      description: "Updated",
    });

    expect(updated.name).toBe("One-arm Dumbbell Row");
    expect(updated.version).toBe(2);
  });

  it("archives a custom exercise without removing its detail record", async () => {
    const repository = new InMemoryExerciseRepository(seed, 0);
    await repository.archive("custom");

    const active = await repository.list(defaultExerciseQuery);
    const archived = await repository.list({ ...defaultExerciseQuery, status: "archived" });
    const detail = await repository.getById("custom");

    expect(active.map((exercise) => exercise.id)).not.toContain("custom");
    expect(archived.map((exercise) => exercise.id)).toContain("custom");
    expect(detail?.archivedAt).not.toBeNull();
  });

  it("keeps starter exercises read-only", async () => {
    const repository = new InMemoryExerciseRepository(seed, 0);

    await expect(repository.archive("starter")).rejects.toMatchObject({
      code: "read-only",
    });
  });

  it("supports the create, search, edit and archive flow through the repository contract", async () => {
    const repository = new InMemoryExerciseRepository(seed, 0);
    const created = await repository.create({
      name: "Incline Press",
      primaryMuscleCode: "chest",
      secondaryMuscleCodes: ["triceps", "shoulders"],
      equipmentCode: "dumbbell",
      description: "Incline bench",
    });

    const searchResults = await repository.list({
      ...defaultExerciseQuery,
      search: "incline",
      muscleCode: "triceps",
      equipmentCode: "dumbbell",
    });
    expect(searchResults.map((exercise) => exercise.id)).toEqual([created.id]);

    await repository.update(created.id, {
      name: "Low Incline Press",
      primaryMuscleCode: "chest",
      secondaryMuscleCodes: ["triceps"],
      equipmentCode: "dumbbell",
      description: "Low incline bench",
    });
    await repository.archive(created.id);

    const archived = await repository.list({ ...defaultExerciseQuery, status: "archived" });
    expect(archived.find((exercise) => exercise.id === created.id)?.name).toBe("Low Incline Press");
  });
});
