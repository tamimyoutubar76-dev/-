export interface RefCropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CHARACTER_REF_IMAGE_URL =
  '/assets/aistudio/file_00000000275082118eadfb0e7497ce25_dd2ae07e.png';

export const CHARACTER_REF_DIMENSIONS = {
  sheetWidth: 1536,
  sheetHeight: 1024,
  totalFigureHeightPx: 999,
  worldHeightM: 1.85,
} as const;

export const CHARACTER_BODY_PROPORTIONS = {
  headWidth: 0.51,
  headHeight: 0.59,
  headDepth: 0.45,
  torsoWidth: 0.44,
  torsoHeight: 0.60,
  torsoDepth: 0.27,
  armWidth: 0.19,
  armHeight: 0.60,
  armDepth: 0.25,
  shoulderY: 1.24,
  hipY: 0.66,
  kneeOffsetY: -0.29,
  thighWidth: 0.21,
  thighHeight: 0.295,
  thighDepth: 0.24,
  shinWidth: 0.22,
  shinHeight: 0.175,
  shinDepth: 0.24,
  shoeWidth: 0.23,
  shoeHeight: 0.195,
  shoeDepth: 0.31,
  shoeForwardOffsetZ: 0.035,
} as const;

/**
 * Exact orthographic 4-view crop rects measured from the 1536x1024 custom friend reference sheet:
 * - Front View: x=[3..460], y=[7..1005]
 * - Back View:  x=[480..941], y=[8..1005]
 * - Left View:  x=[979..1238], y=[13..1009]  (character +X side, facing left)
 * - Right View: x=[1293..1533], y=[17..1008] (character -X side, facing right)
 */
export const CHARACTER_REF_CROPS: Record<string, RefCropRect> = {
  // Cube Head (excluding protruding 3D ears on front/back)
  headFront: { x: 110, y: 10, w: 238, h: 325 },
  headBack: { x: 582, y: 10, w: 262, h: 312 },
  headLeft: { x: 988, y: 12, w: 244, h: 308 },
  headRight: { x: 1296, y: 16, w: 234, h: 302 },
  headTop: { x: 145, y: 40, w: 170, h: 62 },
  headBottom: { x: 170, y: 292, w: 120, h: 30 },

  // Protruding 3D Ears
  earRightFront: { x: 96, y: 182, w: 20, h: 66 },
  earLeftFront: { x: 342, y: 182, w: 20, h: 66 },
  earLeftBack: { x: 566, y: 182, w: 20, h: 66 },
  earRightBack: { x: 840, y: 182, w: 20, h: 66 },
  earLeftSide: { x: 1110, y: 184, w: 36, h: 64 },
  earRightSide: { x: 1388, y: 184, w: 36, h: 64 },

  // Black & Red AC Milan Jersey Torso (adidas / Champions League / ACM crest / bwin)
  torsoFront: { x: 114, y: 344, w: 238, h: 312 },
  torsoBack: { x: 590, y: 342, w: 246, h: 314 },
  torsoSidePattern: { x: 1060, y: 420, w: 112, h: 90 },

  // Arms (Adidas Black/Red/White 3-stripe Sleeve + Skin + Gold Wristwatch on Left Wrist)
  armLeftFront: { x: 354, y: 344, w: 106, h: 314 },
  armLeftBack: { x: 482, y: 342, w: 108, h: 314 },
  armLeftSide: { x: 1048, y: 342, w: 152, h: 314 },

  armRightFront: { x: 4, y: 344, w: 108, h: 314 },
  armRightBack: { x: 836, y: 342, w: 104, h: 314 },
  armRightSide: { x: 1336, y: 342, w: 146, h: 314 },

  // Left Leg (+X, white adidas thigh mark + 3 white outer stripes)
  thighLeftFront: { x: 240, y: 658, w: 120, h: 150 },
  thighLeftBack: { x: 586, y: 658, w: 128, h: 150 },
  thighLeftSide: { x: 1052, y: 658, w: 146, h: 150 },

  shinLeftFront: { x: 240, y: 808, w: 120, h: 92 },
  shinLeftBack: { x: 586, y: 808, w: 128, h: 92 },
  shinLeftSide: { x: 1052, y: 808, w: 146, h: 92 },

  shoeLeftFront: { x: 244, y: 900, w: 162, h: 106 },
  shoeLeftBack: { x: 562, y: 900, w: 152, h: 106 },
  shoeLeftSide: { x: 1006, y: 900, w: 194, h: 106 },

  // Right Leg (-X, 3 white outer stripes)
  thighRightFront: { x: 104, y: 658, w: 132, h: 150 },
  thighRightBack: { x: 718, y: 658, w: 128, h: 150 },
  thighRightSide: { x: 1338, y: 658, w: 144, h: 150 },

  shinRightFront: { x: 104, y: 808, w: 132, h: 92 },
  shinRightBack: { x: 718, y: 808, w: 128, h: 92 },
  shinRightSide: { x: 1338, y: 808, w: 144, h: 92 },

  shoeRightFront: { x: 68, y: 900, w: 162, h: 106 },
  shoeRightBack: { x: 718, y: 900, w: 154, h: 106 },
  shoeRightSide: { x: 1336, y: 900, w: 190, h: 106 },
};
