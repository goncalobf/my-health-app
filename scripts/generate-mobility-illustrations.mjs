// Original Fitlog diagrams. Run with node scripts/generate-mobility-illustrations.mjs.
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const output = new URL("../public/mobility-illustrations/", import.meta.url);
const red = "#ff777b";
const skin = "#e1e2ea";
const far = "#9396a9";
const support = "#686d82";

function line(points, color, width) {
  return `<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function box(x, y, width, height) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="2" fill="#303442" stroke="${support}" stroke-width="1.6"/>`;
}

function path(d, color = red, width = 2) {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

const floor = line([[8, 123], [150, 123]], "#383c4a", 1);
const mat = box(11, 120, 140, 3);
const chair = box(44, 81, 45, 5) + line([[51, 86], [51, 122]], support, 4)
  + line([[82, 86], [82, 122]], support, 4) + line([[45, 81], [45, 42]], support, 5);
const frontChair = box(43, 82, 70, 5) + line([[50, 87], [50, 122]], support, 4)
  + line([[106, 87], [106, 122]], support, 4) + box(46, 49, 64, 19);
const wall = box(137, 22, 10, 101);
const doorframe = box(129, 22, 10, 101);
const table = box(18, 69, 54, 6) + line([[25, 75], [25, 122]], support, 4);
const tallTable = box(10, 64, 44, 6) + line([[18, 70], [18, 122]], support, 4);

function limb(points, color, width) {
  return line(points, "#181a21", width + 3)
    + line(points.slice(0, 2), color, width)
    + line(points.slice(1), color, width - 2);
}

// Arm paths run shoulder–elbow–hand. Leg paths run hip–knee–heel–toe.
// Far limbs render first so crossed and supine poses read clearly.
function person({ head, shoulders, hips, arms, legs, active = [], face = "right" }) {
  const [farShoulder, nearShoulder] = shoulders;
  const [farHip, nearHip] = hips;
  const [x, y] = head;
  const arm = (i) => limb([shoulders[i], ...arms[i]], active.includes(i ? "arm" : "farArm") ? red : i ? skin : far, 7.5);
  const leg = (i) => limb([hips[i], ...legs[i]], active.includes(i ? "leg" : "farLeg") ? red : i ? skin : far, 10);
  const dot = { left: -5, right: 5, front: 0, up: 1 }[face];
  const eyeY = face === "up" ? -5 : -1;
  const nose = face === "front" ? "" : line([[x + dot, y + eyeY + 1], [x + dot * 1.7, y + eyeY + (face === "up" ? -4 : 2)]], active.includes("head") ? red : skin, 2.8);
  const torso = `<polygon points="${[farShoulder, nearShoulder, nearHip, farHip].join(" ")}" fill="#717a94" stroke="#717a94" stroke-width="8.5" stroke-linejoin="round"/>`;

  return arm(0) + leg(0) + torso + leg(1)
    + line([[(farShoulder[0] + nearShoulder[0]) / 2, (farShoulder[1] + nearShoulder[1]) / 2], head], "#a6aec2", 6)
    + `<circle cx="${x}" cy="${y}" r="9" fill="${active.includes("head") ? red : skin}"/>`
    + nose + (face === "front"
      ? `<circle cx="${x + 4}" cy="${y + eyeY}" r="1.15" fill="#252733"/><circle cx="${x - 4}" cy="${y + eyeY}" r="1.15" fill="#252733"/>`
      : `<circle cx="${x + dot}" cy="${y + eyeY}" r="1.35" fill="#252733"/>`)
    + arm(1);
}

const standing = {
  head: [78, 21], shoulders: [[62, 38], [94, 38]], hips: [[69, 75], [87, 75]],
  arms: [[[59, 58], [60, 77]], [[97, 58], [96, 77]]],
  legs: [[[67, 98], [65, 115], [59, 118]], [[89, 98], [91, 115], [97, 118]]],
  face: "front",
};
const seated = {
  ...standing, head: [78, 30], shoulders: [[62, 47], [94, 47]], hips: [[67, 78], [88, 78]],
  arms: [[[60, 66], [67, 86]], [[97, 66], [88, 86]]],
  legs: [[[66, 89], [65, 116], [60, 118]], [[91, 89], [91, 116], [97, 118]]],
};
const chairSide = {
  head: [62, 28], shoulders: [[56, 44], [64, 44]], hips: [[53, 77], [62, 77]],
  arms: [[[60, 63], [75, 79]], [[66, 63], [82, 79]]],
  legs: [[[85, 82], [88, 117], [96, 118]], [[93, 81], [93, 117], [102, 118]]],
};
const supine = {
  head: [28, 103], shoulders: [[45, 107], [44, 111]], hips: [[77, 107], [80, 111]],
  arms: [[[57, 109], [72, 110]], [[59, 112], [74, 113]]],
  legs: [[[106, 82], [130, 114], [136, 116]], [[114, 82], [133, 115], [141, 116]]],
  face: "up",
};
const kneel = {
  head: [70, 24], shoulders: [[65, 40], [74, 40]], hips: [[65, 78], [73, 78]],
  arms: [[[69, 60], [75, 75]], [[81, 59], [102, 81]]],
  legs: [[[63, 113], [34, 116], [29, 117]], [[108, 82], [108, 115], [120, 118]]],
};
const onFours = {
  head: [111, 55], shoulders: [[94, 65], [99, 69]], hips: [[58, 65], [55, 71]],
  arms: [[[96, 88], [93, 112]], [[105, 91], [106, 116]]],
  legs: [[[59, 104], [28, 109], [22, 109]], [[53, 113], [24, 115], [17, 116]]],
};
const wallStance = {
  head: [95, 27], shoulders: [[84, 43], [92, 43]], hips: [[76, 77], [84, 77]],
  arms: [[[110, 55], [134, 52]], [[116, 62], [134, 60]]],
  legs: [[[106, 95], [113, 116], [125, 118]], [[62, 95], [48, 116], [59, 118]]],
};
const lyingSide = {
  head: [26, 100], shoulders: [[42, 107], [43, 98]], hips: [[78, 110], [78, 101]],
  arms: [[[27, 115], [17, 109]], [[59, 107], [71, 111]]],
  legs: [[[109, 113], [136, 114], [143, 117]], [[110, 103], [136, 105], [144, 110]]],
  face: "left",
};

function body(base, changes = {}) {
  return person({ ...base, ...changes });
}

function arrow(d) {
  return `<path d="${d}" fill="none" stroke="${red}" stroke-width="1.8" stroke-linecap="round" marker-end="url(#arrow)"/>`;
}

const uprightHamstring = {
  head: [67, 22], shoulders: [[61, 40], [71, 40]], hips: [[59, 75], [66, 75]],
  arms: [[[66, 61], [71, 77]], [[76, 62], [82, 79]]],
  legs: [[[59, 98], [57, 115], [67, 118]], [[95, 87], [119, 105], [124, 96]]],
  active: ["leg"],
};
const wide = {
  ...standing, arms: [[[53, 57], [32, 62]], [[103, 58], [102, 75]]],
  legs: [[[55, 95], [43, 115], [34, 118]], [[102, 95], [115, 115], [124, 118]]],
};
const ankleRaised = body(chairSide, {
  legs: [chairSide.legs[0], [[93, 80], [106, 108], [118, 110]]], active: ["leg"],
});
const book = {
  head: [48, 91], shoulders: [[55, 103], [62, 92]], hips: [[91, 102], [93, 97]],
  arms: [[[47, 108], [32, 112]], [[47, 105], [32, 107]]],
  legs: [[[118, 98], [114, 118], [122, 118]], [[120, 96], [114, 111], [122, 112]]], face: "left",
};
const pendulum = {
  head: [47, 37], shoulders: [[58, 51], [64, 53]], hips: [[88, 69], [97, 72]],
  arms: [[[48, 62], [37, 61]], [[65, 76], [65, 95]]],
  legs: [[[89, 95], [89, 116], [99, 118]], [[103, 96], [110, 116], [120, 118]]], face: "left",
};
const doorway = {
  head: [82, 25], shoulders: [[69, 41], [92, 41]], hips: [[75, 75], [88, 75]],
  arms: [[[67, 62], [69, 80]], [[123, 51], [127, 32]]],
  legs: [[[73, 98], [64, 114], [70, 118]], [[88, 98], [98, 116], [109, 118]]],
};
const bench = box(112, 77, 38, 6) + line([[143, 83], [143, 122]], support, 4);
const latStart = {
  head: [91, 62], shoulders: [[79, 74], [83, 79]], hips: [[41, 84], [47, 90]],
  arms: [[[99, 74], [120, 74]], [[104, 78], [129, 74]]],
  legs: [[[58, 107], [25, 114], [18, 117]], [[59, 113], [28, 115], [19, 118]]],
};
const openPalm = "M0 -15 L10 -20 L15 -31 Q17 -35 21 -31 L23 -27 L42 -28 Q47 -28 47 -24 Q47 -21 42 -20 L35 -18 L53 -18 Q59 -18 59 -13 Q59 -9 54 -9 L38 -8 L55 -6 Q60 -5 59 -1 Q58 3 53 3 L36 2 L48 7 Q53 9 51 13 Q49 16 44 14 L31 10 L24 15 Q14 19 0 12 Z";
const fist = "M0 -15 L11 -17 Q16 -26 24 -26 L35 -23 Q42 -22 42 -16 L42 -2 Q39 8 32 12 Q19 18 0 12 Z";
const relaxedHand = "M0 -11 Q16 -11 32 -5 L48 0 Q56 4 49 8 L23 8 Q12 11 0 9 Z";

function hand({ angle = 0, shape = openPalm, palm = true, wrist = [83, 69], side = false } = {}) {
  return `<g transform="translate(${wrist}) rotate(${angle})">
    <path d="${shape}" fill="${red}" stroke="#3f1e28" stroke-width="1.3"/>
    ${side ? "" : palm
      ? path("M12 -8 Q11 0 20 6 M24 -12 Q30 -3 25 5", "#793842", 1.5)
      : path("M29 -16 L32 -12 M29 -8 L33 -4 M27 0 L30 4", "#793842", 1.5)}
  </g>`;
}

const forearm = limb([[18, 69], [56, 69], [83, 69]], skin, 27);
const tabletop = box(11, 81, 76, 8);
const palmSetup = forearm + hand();

const illustrations = {
  neckTurn: [
    frontChair + body(seated),
    frontChair + body(seated, { head: [78, 30], face: "right", active: ["head"] })
      + arrow("M60 17 Q80 7 96 20"),
  ],
  neckTilt: [
    frontChair + body(seated),
    frontChair + body(seated, { head: [88, 32], active: ["head"] }) + arrow("M71 16 Q91 12 103 26"),
  ],
  chairTurn: [
    frontChair + body(seated, { arms: [[[65, 63], [90, 50]], [[91, 64], [65, 53]]] }),
    frontChair + body(seated, { head: [82, 30], shoulders: [[73, 46], [94, 48]], face: "right",
      arms: [[[73, 61], [94, 53]], [[96, 62], [76, 54]]], active: ["arm"] })
      + arrow("M98 72 Q114 63 111 46"),
  ],
  sideBend: [
    body(standing),
    body(standing, { head: [104, 26], shoulders: [[86, 39], [116, 50]],
      arms: [[[77, 55], [69, 70]], [[109, 72], [96, 91]]], active: ["arm"] })
      + arrow("M106 85 Q101 98 93 101"),
  ],
  pendulum: [
    table + body(pendulum),
    table + body(pendulum, { arms: [[[48, 62], [37, 65]], [[53, 72], [43, 90]]], active: ["arm"] })
      + arrow("M68 104 Q51 107 38 98"),
  ],
  armLift: [
    mat + body(supine, { arms: [[[47, 84], [49, 61]], [[50, 86], [50, 61]]], active: ["arm", "farArm"] }),
    mat + body(supine, { arms: [[[27, 91], [10, 84]], [[29, 94], [10, 84]]], active: ["arm", "farArm"] })
      + arrow("M46 65 Q24 59 13 75"),
  ],
  crossBody: [
    body(standing, { arms: [[[55, 52], [53, 71]], [[111, 46], [130, 45]]], active: ["arm"] }),
    body(standing, { arms: [[[68, 62], [73, 49]], [[76, 49], [55, 43]]], active: ["arm"] }),
  ],
  chest: [
    doorframe + body(doorway, { active: ["arm"] }),
    doorframe + body(doorway, { head: [89, 26], shoulders: [[76, 43], [99, 43]], hips: [[80, 76], [91, 76]],
      arms: [[[70, 61], [72, 80]], [[123, 51], [127, 32]]],
      legs: [[[71, 97], [64, 114], [70, 118]], [[103, 95], [108, 116], [119, 118]]], active: ["arm"] }),
  ],
  lat: [
    mat + bench + body(latStart),
    mat + bench + body(latStart, { head: [92, 99], shoulders: [[73, 87], [76, 94]], hips: [[32, 80], [37, 87]],
      arms: [[[96, 81], [120, 74]], [[102, 85], [129, 74]]], active: ["arm", "farArm"] })
      + arrow("M48 61 Q31 61 24 72"),
  ],
  triceps: [
    body(standing, { head: [83, 28], arms: [standing.arms[0], [[97, 18], [98, 36]]], active: ["arm"], face: "left" }),
    body(standing, { head: [83, 28], arms: [[[58, 20], [95, 16]], [[97, 16], [103, 45]]], active: ["arm"], face: "left" }),
  ],
  openBook: [
    mat + body(book, { active: ["arm"] }),
    mat + body(book, { head: [60, 89], shoulders: [[55, 103], [64, 91]], face: "up",
      arms: [book.arms[0], [[68, 68], [83, 52]]], active: ["arm"] })
      + arrow("M43 75 Q50 53 72 48"),
  ],
  reachThrough: [
    mat + body(onFours, { arms: [onFours.arms[0], [[84, 97], [58, 105]]], active: ["arm"] })
      + arrow("M79 111 L58 114"),
    mat + body(onFours, { head: [105, 49], shoulders: [[88, 70], [96, 63]], face: "up",
      arms: [onFours.arms[0], [[98, 47], [100, 24]]], active: ["arm"] })
      + arrow("M117 64 Q122 42 109 25"),
  ],
  kneeToChest: [
    mat + body(supine),
    mat + body(supine, { legs: [supine.legs[0], [[79, 66], [106, 76], [109, 83]]],
      arms: [[[57, 90], [77, 80]], [[59, 94], [81, 81]]], active: ["leg"] }),
  ],
  figureFour: [
    mat + body(supine, { legs: [supine.legs[0], [[108, 65], [91, 96], [84, 91]]], active: ["leg"] }),
    mat + body(supine, { legs: [[[94, 71], [119, 91], [125, 91]], [[102, 49], [88, 86], [82, 80]]],
      arms: [[[60, 89], [82, 84]], [[62, 92], [89, 84]]], active: ["leg"] }),
  ],
  hipFlexor: [
    mat + body(kneel),
    mat + body(kneel, { head: [79, 25], shoulders: [[73, 40], [83, 40]], hips: [[73, 76], [81, 76]],
      legs: [kneel.legs[0], [[112, 81], [108, 115], [120, 118]]], active: ["farLeg"] })
      + arrow("M46 74 L62 74"),
  ],
  kneelingRock: [
    mat + body(kneel),
    mat + body(kneel, { head: [79, 25], shoulders: [[73, 40], [83, 40]], hips: [[73, 76], [81, 76]],
      legs: [kneel.legs[0], [[112, 81], [108, 115], [120, 118]]], active: ["farLeg"] })
      + arrow("M47 74 L64 74") + arrow("M63 82 L46 82"),
  ],
  seatedRotation: [
    frontChair + body(seated, { legs: [seated.legs[0], [[91, 89], [80, 111], [84, 114]]], active: ["leg"] }),
    frontChair + body(seated, { legs: [seated.legs[0], [[91, 89], [108, 110], [114, 113]]], active: ["leg"] })
      + arrow("M92 114 Q103 121 115 119"),
  ],
  butterfly: [
    mat + body(standing, { head: [78, 48], shoulders: [[63, 66], [93, 66]], hips: [[68, 102], [89, 102]],
      arms: [[[58, 93], [71, 111]], [[98, 91], [86, 111]]],
      legs: [[[48, 94], [70, 113], [78, 114]], [[111, 94], [87, 113], [78, 114]]], active: ["leg", "farLeg"] }),
    mat + body(standing, { head: [78, 42], shoulders: [[63, 60], [93, 60]], hips: [[68, 102], [89, 102]],
      arms: [[[58, 89], [71, 111]], [[98, 89], [86, 111]]],
      legs: [[[41, 103], [70, 113], [78, 114]], [[117, 103], [87, 113], [78, 114]]], active: ["leg", "farLeg"] }),
  ],
  wideShift: [
    tallTable + body(wide),
    tallTable + body(wide, { head: [60, 26], shoulders: [[45, 44], [75, 44]], hips: [[51, 78], [68, 78]],
      arms: [[[43, 56], [32, 62]], [[84, 61], [75, 78]]],
      legs: [[[39, 96], [43, 115], [34, 118]], [[91, 96], [115, 115], [124, 118]]], active: ["farLeg"] })
      + arrow("M96 35 L78 35"),
  ],
  hamstring: [
    box(109, 109, 36, 14) + body(uprightHamstring),
    box(109, 109, 36, 14) + body(uprightHamstring, { head: [98, 36], shoulders: [[83, 47], [89, 52]],
      arms: [[[79, 67], [89, 79]], [[93, 68], [106, 83]]] }),
  ],
  hamstringGlide: [
    mat + body(supine, { legs: [supine.legs[0], [[88, 68], [118, 76], [124, 83]]],
      arms: [[[59, 86], [79, 79]], [[61, 91], [82, 79]]], active: ["leg"] }),
    mat + body(supine, { legs: [supine.legs[0], [[88, 68], [94, 37], [101, 30]]],
      arms: [[[59, 86], [79, 79]], [[61, 91], [82, 79]]], active: ["leg"] })
      + arrow("M125 65 Q124 47 108 34"),
  ],
  quad: [
    mat + body(lyingSide),
    mat + body(lyingSide, { legs: [lyingSide.legs[0], [[109, 104], [90, 79], [83, 79]]],
      arms: [lyingSide.arms[0], [[60, 85], [85, 80]]], active: ["leg"] }),
  ],
  heelSlide: [
    mat + body(supine, { legs: [[[109, 109], [133, 113], [138, 105]], [[112, 113], [137, 116], [141, 107]]], active: ["leg"] }),
    mat + body(supine, { legs: [[[109, 109], [133, 113], [138, 105]], [[104, 83], [122, 115], [133, 117]]], active: ["leg"] })
      + arrow("M145 100 L127 100"),
  ],
  kneeExtend: [
    chair + body(chairSide, { active: ["leg"] }),
    chair + body(chairSide, { legs: [chairSide.legs[0], [[93, 81], [126, 84], [132, 76]]], active: ["leg"] })
      + arrow("M125 112 Q135 108 138 95"),
  ],
  kneeWall: [
    wall + body(wallStance, { legs: [[[112, 96], [111, 116], [126, 118]], [[72, 96], [62, 116], [73, 118]]], active: ["farLeg"] }),
    wall + body(wallStance, { head: [107, 34], shoulders: [[95, 46], [102, 49]], hips: [[87, 78], [95, 78]],
      legs: [[[131, 94], [111, 116], [126, 118]], [[79, 96], [62, 116], [73, 118]]], active: ["farLeg"] }),
  ],
  ankleDraw: [
    chair + ankleRaised,
    chair + ankleRaised + path("M116 98 L125 79 L134 98 M119 92 L131 92")
      + arrow("M115 109 Q124 113 133 106"),
  ],
  calf: [
    wall + body(wallStance, { active: ["leg"] }),
    wall + body(wallStance, { head: [107, 36], shoulders: [[98, 48], [105, 50]], hips: [[84, 77], [92, 77]],
      legs: [[[116, 95], [113, 116], [125, 118]], [[70, 97], [48, 116], [59, 118]]], active: ["leg"] })
      + arrow("M45 99 L45 111"),
  ],
  bentCalf: [
    wall + body(wallStance, { legs: [wallStance.legs[0], [[71, 95], [61, 116], [73, 118]]], active: ["leg"] }),
    wall + body(wallStance, { hips: [[77, 86], [84, 86]],
      legs: [[[106, 99], [113, 116], [125, 118]], [[91, 99], [61, 116], [73, 118]]], active: ["leg"] })
      + arrow("M57 100 L57 112"),
  ],
  wristBend: [
    tabletop + forearm + hand({ shape: relaxedHand, side: true, angle: -26 }),
    tabletop + forearm + hand({ shape: relaxedHand, side: true, angle: 26 }) + arrow("M130 70 Q138 85 133 96"),
  ],
  wristSide: [
    box(11, 29, 136, 80) + forearm + hand({ angle: -20, palm: false }),
    box(11, 29, 136, 80) + forearm + hand({ angle: 21, palm: false }),
  ],
  forearmTurn: [
    palmSetup,
    forearm + `<g transform="translate(0 138) scale(1 -1)">${hand({ palm: false })}</g>`
      + arrow("M104 39 Q127 25 141 41"),
  ],
  openHand: [
    palmSetup,
    forearm + hand({ shape: fist }),
  ],
  elbowBend: [
    body(standing, { active: ["arm"], arms: [standing.arms[0], [[98, 64], [99, 85]]] }),
    body(standing, { active: ["arm"], arms: [standing.arms[0], [[98, 64], [112, 43]]] })
      + arrow("M116 78 Q122 63 118 49"),
  ],
};

function render(frames) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="420" viewBox="0 0 320 140">
    <defs><marker id="arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="${red}"/></marker></defs>
    <rect width="320" height="140" fill="#16181f"/>
    ${frames.map((frame, index) => `<g transform="translate(${index * 160} 4)"><rect x="4" width="152" height="132" rx="6" fill="#1d2029"/>${floor}${frame}</g>`).join("")}
  </svg>`;
}

await mkdir(output, { recursive: true });
await Promise.all(Object.entries(illustrations).map(([id, frames]) =>
  sharp(Buffer.from(render(frames))).webp({ quality: 88 }).toFile(new URL(id + ".webp", output).pathname),
));
console.log(`Wrote ${Object.keys(illustrations).length} mobility illustrations.`);
