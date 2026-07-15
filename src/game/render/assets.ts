import type { PlayerId } from '../engine/types';

//  Asset manifest seam. v1 draws pebbles/board procedurally (see BoardScene).
//  When sprite art arrives, map keys to image paths here and have BoardScene
//  prefer a loaded texture over a drawn shape. Nothing consumes this yet — it
//  exists so that adding assets is a data change, not a scene rewrite.
export interface AssetManifest {
    pebbles?: Partial<Record<PlayerId, string>>; // player -> image path under public/assets
}

export const ASSETS: AssetManifest = {};

export function pebbleSprite(player: PlayerId): string | undefined {
    return ASSETS.pebbles?.[player];
}
