export type MonacoWorkerMode = "extension-url" | "inline";

type ResolveMonacoWorkerModeOptions = {
  hasRuntimeGetUrl: boolean;
};

export const resolveMonacoWorkerMode = ({
  hasRuntimeGetUrl,
}: ResolveMonacoWorkerModeOptions): MonacoWorkerMode =>
  hasRuntimeGetUrl ? "extension-url" : "inline";
