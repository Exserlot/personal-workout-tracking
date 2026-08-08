import { describe, expect, it } from "vitest";
import {
  SupabaseExerciseRepository,
  SupabaseRestClient,
  type SupabaseDataClient,
  type SupabaseRequest,
} from "./SupabaseExerciseRepository";

const starterRow = {
  id: "bench-press",
  name: "Barbell Bench Press",
  normalized_name: "barbell bench press",
  equipment_code: "barbell",
  notes: "Flat bench press",
  owner_user_id: null,
  archived_at: null,
  version: 1,
  primary_muscle: { code: "chest" },
  exercise_secondary_muscles: [
    { sequence_no: 1, muscle: { code: "triceps" } },
    { sequence_no: 2, muscle: { code: "shoulders" } },
  ],
};

class FakeSupabaseClient implements SupabaseDataClient {
  readonly requests: SupabaseRequest[] = [];

  constructor(private readonly responses: unknown[]) {}

  async request<T>(request: SupabaseRequest): Promise<T> {
    this.requests.push(request);
    return this.responses.shift() as T;
  }
}

describe("SupabaseExerciseRepository", () => {
  it("maps relational rows into the existing domain contract and filters them", async () => {
    const client = new FakeSupabaseClient([[starterRow]]);
    const repository = new SupabaseExerciseRepository(client);

    const result = await repository.list({ search: "bench", muscleCode: "triceps", equipmentCode: "all", status: "active" });

    expect(result[0]).toMatchObject({
      id: "bench-press",
      source: "starter",
      primaryMuscleCode: "chest",
      secondaryMuscleCodes: ["triceps", "shoulders"],
      description: "Flat bench press",
    });
    expect(client.requests[0].path).toContain("archived_at=is.null");
  });

  it("creates through the transactional RPC and validates the returned Exercise", async () => {
    const customRow = { ...starterRow, id: "custom-1", owner_user_id: "owner-1", name: "Custom Press", normalized_name: "custom press" };
    const client = new FakeSupabaseClient([[], { id: "custom-1" }, [customRow]]);
    const repository = new SupabaseExerciseRepository(client);

    const result = await repository.create({
      name: "Custom Press",
      primaryMuscleCode: "chest",
      secondaryMuscleCodes: ["triceps"],
      equipmentCode: "barbell",
      description: "A custom variation",
    });

    expect(result.source).toBe("custom");
    expect(client.requests[1]).toMatchObject({ method: "POST", path: "rpc/create_custom_exercise" });
    expect(client.requests[1].body).toMatchObject({ p_normalized_name: "custom press", p_secondary_muscle_codes: ["triceps"] });
  });

  it("rejects malformed database responses before they reach the UI", async () => {
    const client = new FakeSupabaseClient([[{ ...starterRow, equipment_code: "unsupported" }]]);
    const repository = new SupabaseExerciseRepository(client);

    await expect(repository.list({ search: "", muscleCode: "all", equipmentCode: "all", status: "active" })).rejects.toMatchObject({ code: "unknown" });
  });
});

describe("SupabaseRestClient", () => {
  it("sends an opaque publishable key only as apikey when there is no user session", async () => {
    let requestInit: RequestInit | undefined;
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init;
      return new Response("[]", { status: 200 });
    }) as typeof fetch;
    const client = new SupabaseRestClient({
      url: "http://127.0.0.1:54321",
      anonKey: "sb_publishable_local-test",
      fetchImpl,
      accessToken: () => null,
    });

    await client.request({ method: "GET", path: "exercises" });

    const headers = new Headers(requestInit?.headers);
    expect(headers.get("apikey")).toBe("sb_publishable_local-test");
    expect(headers.has("Authorization")).toBe(false);
  });

  it("uses the signed-in user's JWT as Authorization", async () => {
    let requestInit: RequestInit | undefined;
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestInit = init;
      return new Response("[]", { status: 200 });
    }) as typeof fetch;
    const client = new SupabaseRestClient({
      url: "http://127.0.0.1:54321",
      anonKey: "sb_publishable_local-test",
      fetchImpl,
      accessToken: () => "user.jwt.token",
    });

    await client.request({ method: "GET", path: "exercises" });

    const headers = new Headers(requestInit?.headers);
    expect(headers.get("Authorization")).toBe("Bearer user.jwt.token");
  });
});
