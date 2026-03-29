import { parseScriptMetadata } from "$lib/utils/script-metadata";

export type CreateLandingExampleScriptArgs = {
  id: string;
  fileName: string;
  content: string;
  cardDescription: string;
};

export type LandingExampleScript = {
  id: string;
  fileName: string;
  downloadName: string;
  content: string;
  title: string;
  website: string;
  description: string;
  cardDescription: string;
};

export const createLandingExampleScript = ({
  id,
  fileName,
  content,
  cardDescription,
}: CreateLandingExampleScriptArgs): LandingExampleScript => {
  const metadata = parseScriptMetadata(content);
  if (!metadata) {
    throw new Error(`Missing Page Proxy metadata in ${fileName}`);
  }

  return {
    id,
    fileName,
    downloadName: fileName,
    content,
    title: metadata.title,
    website: metadata.website,
    description: metadata.description,
    cardDescription,
  };
};
