import type { Namespace } from 'socket.io';

let communityNamespace: Namespace | null = null;

export function setCommunityNs(namespace: Namespace): void {
  communityNamespace = namespace;
}

export function getCommunityNs(): Namespace | null {
  return communityNamespace;
}
