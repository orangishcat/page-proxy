declare module "*?raw" {
  const content: string;
  export default content;
}

declare module "*?worker" {
  const workerFactory: {
    new (options?: WorkerOptions): Worker;
  };
  export default workerFactory;
}
