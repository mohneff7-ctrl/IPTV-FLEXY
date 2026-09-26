// Types for the Stremio addon protocol.
// Spec: https://github.com/Stremio/stremio-addon-sdk/tree/master/docs/api

export type ResourceName = 'catalog' | 'meta' | 'stream' | 'subtitles' | 'addon_catalog' | string;

export interface ResourceDescriptor {
  name: ResourceName;
  types?: string[];
  idPrefixes?: string[];
}

export interface ExtraProp {
  name: string;
  isRequired?: boolean;
  options?: string[];
  optionsLimit?: number;
}

export interface ManifestCatalog {
  type: string;
  id: string;
  name?: string;
  genres?: string[];
  extra?: ExtraProp[];
  extraSupported?: string[];
  extraRequired?: string[];
  pageSize?: number;
}

export interface Manifest {
  id: string;
  version: string;
  name: string;
  description?: string;
  logo?: string;
  background?: string;
  types: string[];
  resources: (ResourceName | ResourceDescriptor)[];
  idPrefixes?: string[];
  catalogs: ManifestCatalog[];
  addonCatalogs?: ManifestCatalog[];
  behaviorHints?: {
    adult?: boolean;
    p2p?: boolean;
    configurable?: boolean;
    configurationRequired?: boolean;
  };
}

export interface Addon {
  /** Full manifest URL, e.g. https://v3-cinemeta.strem.io/manifest.json */
  transportUrl: string;
  manifest: Manifest;
  /** Built-in addons cannot be removed (they keep the app usable). */
  protected?: boolean;
}

export interface Video {
  id: string;
  title?: string;
  name?: string;
  released?: string;
  firstAired?: string;
  thumbnail?: string;
  season?: number;
  episode?: number;
  number?: number;
  overview?: string;
  description?: string;
  streams?: Stream[];
  available?: boolean;
  rating?: string;
}

export interface MetaLink {
  name: string;
  category: string;
  url: string;
}

export interface MetaPreview {
  id: string;
  type: string;
  name: string;
  poster?: string;
  posterShape?: 'poster' | 'landscape' | 'square' | 'regular';
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  year?: string;
  imdbRating?: string;
  genres?: string[];
  genre?: string[];
  runtime?: string;
  country?: string;
  links?: MetaLink[];
  trailers?: { source: string; type: string }[];
  trailerStreams?: { ytId?: string; title?: string }[];
}

export interface Meta extends MetaPreview {
  videos?: Video[];
  cast?: string[];
  director?: string[];
  writer?: string[];
  released?: string;
  status?: string;
  language?: string;
  awards?: string;
  website?: string;
  behaviorHints?: { defaultVideoId?: string | null; hasScheduledVideos?: boolean };
  app_extras?: {
    cast?: { name: string; character?: string; photo?: string }[];
    directors?: { name: string; photo?: string }[];
    writers?: { name: string; photo?: string }[];
  };
}

export interface Stream {
  url?: string;
  ytId?: string;
  infoHash?: string;
  fileIdx?: number;
  externalUrl?: string;
  name?: string;
  title?: string;
  description?: string;
  sources?: string[];
  subtitles?: Subtitle[];
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    countryWhitelist?: string[];
    proxyHeaders?: { request?: Record<string, string>; response?: Record<string, string> };
    videoSize?: number;
    filename?: string;
  };
}

export interface Subtitle {
  id?: string;
  url: string;
  lang: string;
}

/** A stream together with the addon that returned it. */
export interface SourcedStream extends Stream {
  addonId: string;
  addonName: string;
}
