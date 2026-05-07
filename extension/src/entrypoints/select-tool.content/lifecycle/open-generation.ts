export type OpenGenerationToken = number;

export const createOpenGenerationGate = () => {
  let currentGeneration = 0;

  return {
    begin(): OpenGenerationToken {
      currentGeneration += 1;
      return currentGeneration;
    },
    invalidate(): void {
      currentGeneration += 1;
    },
    isCurrent(token: OpenGenerationToken): boolean {
      return token === currentGeneration;
    },
  };
};
