/** Screen positions of things on the 3D device, registered by the scene, read by the guide. */
export type Anchor = () => { x: number; y: number } | null;
export const anchors: Record<string, Anchor> = {};
