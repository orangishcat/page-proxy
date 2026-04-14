import deepEqual from "fast-deep-equal";
import { snapshot } from "svelte/internal/client";

export type AppStatePersistEntry<T = unknown> = {
  name: string;
  read(): T;
  persist(current: T, previous: T): Promise<void> | void;
};

const snapshotState = snapshot as <T>(value: T) => T;
const clone = <T>(value: T): T => snapshotState(value);

export class AppStatePersistHandler {
  private readonly previousValues = new Map<string, unknown>();

  constructor(private readonly registry: readonly AppStatePersistEntry[]) {
    this.registry.forEach((entry) => {
      this.previousValues.set(entry.name, clone(entry.read()));
    });
  }

  async checkPersist() {
    for (const entry of this.registry) {
      const current = entry.read();
      const previous = this.previousValues.get(entry.name);
      if (deepEqual(current, previous)) {
        continue;
      }

      await entry.persist(current, previous);
      this.previousValues.set(entry.name, clone(current));
    }
  }
}
