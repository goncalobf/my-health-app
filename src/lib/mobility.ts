export const mobilitySources = {
  nhs: { name: "NHS flexibility exercises", url: "https://www.nhs.uk/live-well/exercise/flexibility-exercises/" },
  sitting: { name: "NHS seated exercises", url: "https://www.nhs.uk/live-well/exercise/sitting-exercises/" },
  cooldown: { name: "NHS post-workout stretches", url: "https://www.nhs.uk/live-well/exercise/how-to-stretch-after-exercising/" },
  mayo: { name: "Mayo Clinic basic stretches", url: "https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20546848" },
  shoulder: { name: "AAOS shoulder movements", url: "https://www.orthoinfo.org/bodypart/shoulder/rotator-cuff-and-shoulder-conditioning-program/" },
  shoulderReach: { name: "Gateshead Health NHS shoulder movements", url: "https://www.gatesheadhealth.nhs.uk/resources/soft-tissue-injury-of-the-shoulder/" },
  hip: { name: "Berkshire Healthcare NHS hip movements", url: "https://www.berkshirehealthcare.nhs.uk/media/168330/oesteoarthritis_of_the_hip_leaflet.pdf" },
  warmup: { name: "ACE warm-up and mobility drills", url: "https://www.acefitness.org/certifiednewsarticle/2910/a-detailed-guide-to-designing-activity-specific-warm-up-and-mobility-drills/" },
  lat: { name: "ACE bench-supported lat stretch", url: "https://www.acefitness.org/resources/everyone/exercise-library/141/kneeling-lat-stretch-w-bench/" },
  triceps: { name: "ACE triceps stretch", url: "https://www.acefitness.org/resources/everyone/exercise-library/174/overhead-triceps-stretch/" },
  back: { name: "AAOS spine movements", url: "https://www.orthoinfo.org/bodypart/back/spine-conditioning-program/" },
  thoracic: { name: "ACE thoracic mobility", url: "https://www.acefitness.org/resources/pros/expert-articles/7960/thoracic-mobility-exercises-to-address-shoulder-pain/" },
  ankles: { name: "NHS ankle mobility", url: "https://www.opalreturntowork.nhs.uk/exercises/knee-to-wall-stretch/" },
  calves: { name: "Royal Orthopaedic Hospital calf stretches", url: "https://roh.nhs.uk/services-information/foot-and-ankle/calf-stretching" },
  knees: { name: "Cambridge University Hospitals NHS knee movements", url: "https://www.cuh.nhs.uk/patient-information/knee-exercises/" },
  wrists: { name: "Royal United Hospitals NHS wrist movements", url: "https://ruh.nhs.uk/patients/patient_information/HTH024_Wrist_Exercises.pdf" },
  hands: { name: "Frimley Health NHS hand and elbow movements", url: "https://www.fhft.nhs.uk/patients-and-visitors/patient-information-library/elbow-wrist-and-hand" },
  ankleFoot: { name: "AAOS foot and ankle movements", url: "https://www.orthoinfo.org/bodypart/foot-ankle/foot-and-ankle-conditioning-program/" },
} as const;

type Source = keyof typeof mobilitySources;
type Move = {
  name: string;
  cue: string;
  dose: { reps: number } | { seconds: number };
  eachSide?: boolean;
  secondsPerRep?: number;
  source: Source;
};

const moves = {
  neckTurn: {
    name: "Easy neck turn",
    dose: { reps: 4 },
    eachSide: true,
    source: "nhs",
    cue: "Sit tall and turn your head slowly toward one shoulder. Return to center before each repetition.",
  },
  neckTilt: {
    name: "Side neck stretch",
    dose: { seconds: 10 },
    eachSide: true,
    source: "nhs",
    cue: "Let both shoulders hang comfortably. Tip one ear toward the same-side shoulder without pulling on your head.",
  },
  chairTurn: {
    name: "Seated upper-back turn",
    dose: { reps: 5 },
    eachSide: true,
    source: "sitting",
    cue: "Sit on a sturdy chair with feet flat and arms folded loosely across your chest. Turn your ribs to one side while your hips stay facing ahead.",
  },
  sideBend: {
    name: "Standing side bend",
    dose: { reps: 5 },
    eachSide: true,
    source: "nhs",
    cue: "Slide one hand down the same-side thigh and return upright. Keep your chest facing ahead.",
  },
  pendulum: {
    name: "Shoulder pendulum",
    dose: { reps: 8 },
    eachSide: true,
    source: "shoulder",
    cue: "Support yourself on a sturdy table and let the other arm hang loosely. Use a small weight shift to let it swing gently forward and back.",
  },
  armLift: {
    name: "Supported overhead reach",
    dose: { reps: 6 },
    source: "shoulderReach",
    cue: "Lie with knees bent. Clasp your hands and slowly guide them toward overhead. Stop before your lower back starts to arch.",
  },
  crossBody: {
    name: "Cross-body shoulder stretch",
    dose: { seconds: 20 },
    eachSide: true,
    source: "shoulder",
    cue: "Bring an arm across your chest. Use your other hand on the upper arm to gently draw it closer while keeping the shoulder low.",
  },
  chest: {
    name: "Doorway chest stretch",
    dose: { seconds: 20 },
    eachSide: true,
    source: "warmup",
    cue: "Rest your forearm on a doorframe with your elbow comfortably below shoulder height. Step forward just enough to feel tension across the chest.",
  },
  lat: {
    name: "Bench-supported lat stretch",
    dose: { seconds: 20 },
    source: "lat",
    cue: "Rest your hands on a sturdy bench. Send your hips back and let your chest sink slightly between your arms. Keep your ribs from flaring.",
  },
  triceps: {
    name: "Overhead triceps stretch",
    dose: { seconds: 20 },
    eachSide: true,
    source: "triceps",
    cue: "Reach a hand toward your upper back. If comfortable, steady that elbow with your free hand. Keep your neck relaxed.",
  },
  openBook: {
    name: "Side-lying open book",
    dose: { reps: 5 },
    eachSide: true,
    source: "thoracic",
    cue: "Lie on your side with knees bent and stacked. Sweep the top arm open while your chest follows. Let your hand stop wherever your upper back can turn smoothly.",
  },
  reachThrough: {
    name: "All-fours upper-back rotation",
    dose: { reps: 5 },
    eachSide: true,
    source: "thoracic",
    cue: "On hands and knees, reach one arm under your chest. Return and turn toward that side, keeping the hips steady.",
  },
  kneeToChest: {
    name: "Single knee to chest",
    dose: { seconds: 20 },
    eachSide: true,
    source: "back",
    cue: "Lie face up. Support one thigh and guide it toward your torso. Leave the other foot on the floor if that feels easier.",
  },
  figureFour: {
    name: "Supine figure-four",
    dose: { seconds: 20 },
    eachSide: true,
    source: "cooldown",
    cue: "Cross one ankle over the other thigh. Hold the supporting thigh and draw it in gently. Stop if the crossed knee feels strained.",
  },
  hipFlexor: {
    name: "Half-kneeling hip flexor stretch",
    dose: { seconds: 20 },
    eachSide: true,
    source: "mayo",
    cue: "Pad the knee on the floor. Tuck your pelvis slightly and move forward a small distance with your torso upright.",
  },
  kneelingRock: {
    name: "Half-kneeling hip rocks",
    dose: { reps: 6 },
    eachSide: true,
    source: "mayo",
    cue: "In a padded half-kneeling stance, keep your ribs over your hips. Rock forward a little until you feel the front of the rear hip, then ease back.",
  },
  seatedRotation: {
    name: "Seated hip rotation",
    dose: { reps: 6 },
    eachSide: true,
    source: "hip",
    cue: "Sit on a chair with knees bent and lift one foot just enough to clear the floor. Move your lower leg slowly from side to side without lifting or twisting your thigh.",
  },
  butterfly: {
    name: "Seated butterfly stretch",
    dose: { seconds: 25 },
    source: "cooldown",
    cue: "Bring the soles of your feet together and sit tall. Let the knees settle naturally. Move your feet farther away if you need less tension.",
  },
  wideShift: {
    name: "Supported side-to-side weight shift",
    dose: { reps: 6 },
    eachSide: true,
    source: "warmup",
    cue: "Stand in a comfortable wide stance beside a counter. Shift over a softly bent knee while the other leg lengthens, then come back to center.",
  },
  hamstring: {
    name: "Supported hamstring stretch",
    dose: { seconds: 20 },
    eachSide: true,
    source: "mayo",
    cue: "Set one heel on a low, stable step with the knee soft. Hinge from the hips until you feel the back of the thigh.",
  },
  hamstringGlide: {
    name: "Supine active knee extension",
    dose: { reps: 6 },
    eachSide: true,
    source: "knees",
    cue: "Lie on your back and support one thigh behind the knee. Straighten the raised leg only as far as comfortable, then bend it again.",
  },
  quad: {
    name: "Side-lying quad stretch",
    dose: { seconds: 20 },
    eachSide: true,
    source: "cooldown",
    cue: "Lie on your side, bend your upper knee, and hold the foot if it is easy to reach. Keep your thighs near each other and your pelvis steady.",
  },
  heelSlide: {
    name: "Heel slide",
    dose: { reps: 8 },
    eachSide: true,
    source: "knees",
    cue: "Lie with legs outstretched. Slide one heel toward your hips to bend the knee, then slowly slide it away again.",
  },
  kneeExtend: {
    name: "Seated knee extension",
    dose: { reps: 8 },
    eachSide: true,
    source: "knees",
    cue: "Sit in a stable chair. Lift one foot to straighten the knee while the thigh stays supported. Lower slowly.",
  },
  kneeWall: {
    name: "Knee-to-wall ankle rocks",
    dose: { reps: 8 },
    eachSide: true,
    source: "ankles",
    cue: "Face a wall with one foot close to it. Guide your knee toward the wall over your toes and return while your heel stays down.",
  },
  ankleDraw: {
    name: "Ankle alphabet",
    dose: { reps: 1 },
    eachSide: true,
    secondsPerRep: 30,
    source: "ankleFoot",
    cue: "Sit and lift one foot just off the floor. Trace a small alphabet in the air with your toes, moving mainly at the ankle.",
  },
  calf: {
    name: "Straight-knee calf stretch",
    dose: { seconds: 20 },
    eachSide: true,
    source: "calves",
    cue: "With hands on a wall, step one foot back. Keep the rear leg straight and press through the back heel with both feet pointing ahead.",
  },
  bentCalf: {
    name: "Bent-knee calf stretch",
    dose: { seconds: 20 },
    eachSide: true,
    source: "calves",
    cue: "Take a short staggered stance at a wall. Bend the back knee a little while keeping its heel down.",
  },
  wristBend: {
    name: "Wrist bends",
    dose: { reps: 8 },
    eachSide: true,
    source: "wrists",
    cue: "Support your forearm on a table and let the hand hang off the edge. Lift and lower the hand slowly with relaxed fingers.",
  },
  wristSide: {
    name: "Wrist side glide",
    dose: { reps: 8 },
    eachSide: true,
    source: "wrists",
    cue: "Rest your forearm and palm on a smooth table. Slide your hand toward the thumb side, then toward the little-finger side.",
  },
  forearmTurn: {
    name: "Palm-up and palm-down rotation",
    dose: { reps: 8 },
    eachSide: true,
    source: "wrists",
    cue: "Keep your elbow tucked beside your waist. Turn the palm upward and then downward without moving your upper arm.",
  },
  openHand: {
    name: "Open hand and loose fist",
    dose: { reps: 8 },
    source: "hands",
    cue: "Spread your fingers comfortably, then curl them into a loose fist. Keep both wrists neutral.",
  },
  elbowBend: {
    name: "Active elbow bend",
    dose: { reps: 8 },
    eachSide: true,
    source: "hands",
    cue: "Let your upper arm hang at your side. Bring the hand toward your shoulder and straighten the elbow slowly.",
  },
} satisfies Record<string, Move>;

export const mobilityGroups = ["Whole body", "Upper body", "Lower body", "Sport prep"] as const;
type Group = (typeof mobilityGroups)[number];

export interface MobilityRoutine {
  id: string;
  name: string;
  group: Group;
  focus: string;
  mode: "Mobility" | "Flexibility";
  equipment: string;
  moves: (keyof typeof moves)[];
}

export const mobilityRoutines: MobilityRoutine[] = [
  {
    id: "daily-mobility",
    name: "Daily full-body mobility",
    group: "Whole body",
    focus: "A short head-to-toe range-of-motion session.",
    mode: "Mobility",
    equipment: "Mat, chair, wall",
    moves: ["neckTurn", "armLift", "openBook", "seatedRotation", "kneeWall"],
  },
  {
    id: "full-body-flexibility",
    name: "Full-body flexibility",
    group: "Whole body",
    focus: "Held stretches for a cooldown or separate session.",
    mode: "Flexibility",
    equipment: "Mat, doorway, wall, low step",
    moves: ["figureFour", "hamstring", "hipFlexor", "calf", "chest", "crossBody"],
  },
  {
    id: "desk-break",
    name: "Desk break",
    group: "Whole body",
    focus: "Neck, upper back and wrists with no floor work.",
    mode: "Mobility",
    equipment: "Chair, table",
    moves: ["neckTurn", "chairTurn", "elbowBend", "wristBend", "forearmTurn"],
  },
  {
    id: "hip-mobility",
    name: "Hip mobility",
    group: "Lower body",
    focus: "Hip rotation, extension and side-to-side movement.",
    mode: "Mobility",
    equipment: "Mat, chair, counter",
    moves: ["seatedRotation", "kneelingRock", "wideShift", "heelSlide"],
  },
  {
    id: "shoulder-mobility",
    name: "Shoulder mobility",
    group: "Upper body",
    focus: "Gentle shoulder motion and overhead reach.",
    mode: "Mobility",
    equipment: "Mat, sturdy table",
    moves: ["pendulum", "armLift", "openBook", "reachThrough"],
  },
  {
    id: "upper-back",
    name: "Upper-back mobility",
    group: "Upper body",
    focus: "Thoracic rotation and controlled side bending.",
    mode: "Mobility",
    equipment: "Mat",
    moves: ["sideBend", "openBook", "reachThrough"],
  },
  {
    id: "neck-mobility",
    name: "Neck mobility",
    group: "Upper body",
    focus: "Easy turns and gentle range around the neck.",
    mode: "Mobility",
    equipment: "Chair",
    moves: ["neckTurn", "neckTilt", "sideBend"],
  },
  {
    id: "chest-lats",
    name: "Chest, lats & triceps",
    group: "Upper body",
    focus: "Held stretches around the chest, shoulders and arms.",
    mode: "Flexibility",
    equipment: "Doorway, bench",
    moves: ["chest", "lat", "triceps", "crossBody"],
  },
  {
    id: "wrists-hands-elbows",
    name: "Wrists, hands & elbows",
    group: "Upper body",
    focus: "Active range for the forearms, wrists and hands.",
    mode: "Mobility",
    equipment: "Table",
    moves: ["openHand", "wristBend", "wristSide", "forearmTurn", "elbowBend"],
  },
  {
    id: "ankles-feet",
    name: "Ankle & foot mobility",
    group: "Lower body",
    focus: "Ankle control, forward knee travel and calf length.",
    mode: "Mobility",
    equipment: "Chair, wall",
    moves: ["ankleDraw", "kneeWall", "calf", "bentCalf"],
  },
  {
    id: "knee-mobility",
    name: "Knee mobility",
    group: "Lower body",
    focus: "Controlled bending and straightening through a comfortable range.",
    mode: "Mobility",
    equipment: "Mat, chair, wall",
    moves: ["heelSlide", "kneeExtend", "hamstringGlide", "kneeWall"],
  },
  {
    id: "lower-back-hips",
    name: "Lower back & hips",
    group: "Lower body",
    focus: "Gentle range through the trunk and hips.",
    mode: "Mobility",
    equipment: "Mat",
    moves: ["sideBend", "openBook", "kneeToChest", "figureFour"],
  },
  {
    id: "posterior-chain",
    name: "Hamstrings, glutes & calves",
    group: "Lower body",
    focus: "A cooldown focused on the back of the legs.",
    mode: "Flexibility",
    equipment: "Mat, wall, low step",
    moves: ["hamstring", "figureFour", "calf", "bentCalf"],
  },
  {
    id: "quads-hip-flexors",
    name: "Quads & hip flexors",
    group: "Lower body",
    focus: "Held stretches for the front of the hips and thighs.",
    mode: "Flexibility",
    equipment: "Mat or folded towel",
    moves: ["hipFlexor", "quad", "butterfly"],
  },
  {
    id: "adductors-glutes",
    name: "Adductors & glutes",
    group: "Lower body",
    focus: "Inner-thigh and outer-hip flexibility.",
    mode: "Flexibility",
    equipment: "Mat, counter",
    moves: ["wideShift", "butterfly", "figureFour"],
  },
  {
    id: "pre-lift",
    name: "Pre-lift mobility",
    group: "Sport prep",
    focus: "Controlled reps before lower- or upper-body lifting.",
    mode: "Mobility",
    equipment: "Mat, wall, counter",
    moves: ["kneeWall", "kneelingRock", "wideShift", "openBook", "armLift"],
  },
  {
    id: "jiu-jitsu-warmup",
    name: "Jiu-jitsu mat prep",
    group: "Sport prep",
    focus: "Easy hip rotation, upper-back motion and wrist prep before class.",
    mode: "Mobility",
    equipment: "Mat, chair, counter, table",
    moves: ["seatedRotation", "wideShift", "openBook", "wristBend", "forearmTurn"],
  },
  {
    id: "post-jiu-jitsu",
    name: "Jiu-jitsu cooldown",
    group: "Sport prep",
    focus: "A relaxed cooldown for hips, legs and upper body after rolling.",
    mode: "Flexibility",
    equipment: "Mat, doorway, low step",
    moves: ["figureFour", "hipFlexor", "hamstring", "butterfly", "chest", "crossBody"],
  },
];

export function getMobilityRoutine(id: string) {
  return mobilityRoutines.find((routine) => routine.id === id);
}

const prefix = "mobility:";
export function mobilityActivityType(routine: MobilityRoutine) {
  return prefix + routine.id;
}

export function loggedMobilityRoutine(type: string) {
  return type.startsWith(prefix) ? getMobilityRoutine(type.slice(prefix.length)) : undefined;
}

export function mobilitySteps(routine: MobilityRoutine) {
  return routine.moves.flatMap((id) => {
    const move: Move = moves[id];
    return (move.eachSide ? ["Left", "Right"] : [null]).map((side) => ({ ...move, side }));
  });
}

export function mobilityMinutes(routine: MobilityRoutine) {
  const seconds = mobilitySteps(routine).reduce((total, step) =>
    total + ("seconds" in step.dose ? step.dose.seconds : step.dose.reps * (step.secondsPerRep ?? 4)) + 10,
  0);
  return Math.ceil(seconds / 60);
}

export function searchMobilityRoutines(query: string, group: Group | "All") {
  const normalize = (text: string) => text.toLowerCase().replace(/s\b/g, "");
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return mobilityRoutines.filter((routine) => {
    if (group !== "All" && routine.group !== group) return false;
    const searchable = normalize([
      routine.name, routine.focus, routine.mode, ...routine.moves.map((move) => moves[move].name),
    ].join(" "));
    return terms.every((term) => searchable.includes(term));
  });
}
