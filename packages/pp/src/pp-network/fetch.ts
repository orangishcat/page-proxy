import { runNetworkFetch } from "./_core";
import type { NetworkFetchInput, NetworkFetchOptions } from "./_core";

export const fetch = (input: NetworkFetchInput, options: NetworkFetchOptions = {}) => runNetworkFetch(input, options);
