import rootPkg from "../../../../package.json" with { type: "json" };

export function normalizeReleaseVersion(version: string): string {
  return version.startsWith("v") ? version.slice(1) : version;
}

export const releaseVersion = normalizeReleaseVersion(rootPkg.version);
