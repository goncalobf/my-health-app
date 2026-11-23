// Original Fitlog illustrations for variations that need their own setup.
import sharp from "sharp";

const output = new URL("../public/exercise-demos/", import.meta.url);
const red = "#ff777b";
const figure = "#e1e2ea";
const far = "#969bb0";
const equipment = "#70768b";

function stroke(points, width, color) {
  return `<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function mat(x, y, width, height, color = equipment) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="2" fill="${color}"/>`;
}

function weight([x, y]) {
  return mat(x - 10, y - 3, 20, 6, "#a6aabb")
    + mat(x - 10, y - 8, 6, 16) + mat(x + 4, y - 8, 6, 16);
}

// Coordinates are side profiles. Near arm and leg lines start at their joint.
function person({ head, shoulder, hip, nearArm, farArm, nearLeg, farLeg, highlight = "arm" }) {
  const [x, y] = head;
  return (farLeg ? stroke([hip, ...farLeg], 9, far) : "")
    + (farArm ? stroke([shoulder, ...farArm], 7, far) : "")
    + stroke([hip, shoulder], 19, "#69728d")
    + stroke([shoulder, head], 7, far)
    + stroke([hip, ...nearLeg], 10, highlight === "leg" ? red : figure)
    + stroke([shoulder, ...nearArm], 7, highlight === "arm" ? red : figure)
    + `<circle cx="${x}" cy="${y}" r="10" fill="${figure}"/><circle cx="${x + 4}" cy="${y - 1}" r="1.4" fill="#202129"/>`;
}

const floor = stroke([[12, 165], [168, 165]], 1, "#454959");
const rail = stroke([[150, 33], [150, 161]], 5, equipment);
const calfStance = {
  head: [90, 37], shoulder: [88, 56], hip: [88, 102],
  nearArm: [[90, 81], [86, 105]], farArm: [[116, 64], [149, 64]],
  farLeg: [[68, 113], [58, 137], [66, 143]], highlight: "leg",
};
const calfStep = mat(76, 147, 62, 17);
const calfWeight = weight([87, 108]);

const upperCable = stroke([[16, 25], [16, 162]], 6, equipment);
const cableStance = {
  head: [83, 47], shoulder: [81, 66], hip: [75, 107], farArm: [[99, 88], [101, 107]],
  nearLeg: [[100, 133], [111, 155], [123, 159]], farLeg: [[61, 131], [45, 156], [57, 160]],
};
const bench = stroke([[27, 134], [104, 71]], 7, equipment) + stroke([[43, 134], [43, 164], [108, 164], [108, 71]], 5, equipment);
const prone = {
  head: [111, 53], shoulder: [92, 68], hip: [58, 103],
  nearLeg: [[42, 134], [23, 153], [15, 155]], farLeg: [[49, 141], [29, 156], [18, 158]],
};
const press = stroke([[99, 153], [173, 52]], 4, equipment)
  + stroke([[35, 137], [35, 161], [132, 161], [132, 128]], 4, equipment)
  + stroke([[21, 111], [73, 149], [95, 143]], 7, equipment);
const pressing = {
  head: [28, 100], shoulder: [40, 115], hip: [67, 138],
  nearArm: [[45, 137], [73, 145]], farArm: [[44, 125], [67, 130]], highlight: "leg",
};

const frames = {
  "supported-loaded-calf-raise": [
    rail + calfStep + person({ ...calfStance, nearLeg: [[88, 126], [82, 147], [100, 145]] }) + calfWeight,
    rail + calfStep + person({ ...calfStance, head: [90, 29], shoulder: [88, 48], hip: [88, 93],
      nearLeg: [[88, 117], [87, 132], [99, 145]] }) + weight([87, 100]),
  ],
  "single-arm-overhead-cable-extension": [
    upperCable + stroke([[16, 57], [59, 64]], 1.5, equipment)
      + person({ ...cableStance, nearArm: [[85, 48], [59, 63]] }),
    upperCable + stroke([[16, 57], [105, 31]], 1.5, equipment)
      + person({ ...cableStance, nearArm: [[90, 48], [105, 31]] }),
  ],
  "prone-incline-rear-delt-fly": [
    bench + person({ ...prone, nearArm: [[94, 98], [99, 122]], farArm: [[106, 87], [112, 112]] })
      + weight([99, 124]) + weight([113, 113]),
    bench + person({ ...prone, nearArm: [[69, 73], [43, 63]], farArm: [[116, 76], [139, 67]] })
      + weight([43, 64]) + weight([139, 68]),
  ],
  "high-foot-leg-press": [
    press + stroke([[110, 129], [154, 78]], 6, equipment)
      + person({ ...pressing, nearLeg: [[91, 98], [132, 103], [142, 90]],
      farLeg: [[101, 98], [136, 95], [145, 84]] }),
    press + stroke([[120, 89], [168, 36]], 6, equipment)
      + person({ ...pressing, nearLeg: [[105, 111], [146, 64], [157, 53]],
        farLeg: [[111, 106], [150, 56], [160, 47]] }),
  ],
};

await Promise.all(Object.entries(frames).flatMap(([id, pair]) => pair.map((frame, index) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="540" height="540">
    <rect width="180" height="180" fill="#1d2029"/>${floor}${frame}</svg>`))
    .webp({ quality: 90 })
    .toFile(new URL(`${id}-${index}.webp`, output).pathname),
)));
