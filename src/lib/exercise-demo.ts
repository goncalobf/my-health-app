import catalog from "./exercise-demo-catalog.json";

const revision = "b0eed061e1c832b3ed815fbaa4b45b3cdc14df49";
const repository = "https://github.com/yuhonas/free-exercise-db";
const catalogRoot = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${revision}/exercises`;
const illustrationSource = "https://github.com/hitmanrepo/open-exercise-illustrations";
type CatalogId = keyof typeof catalog;

export type ExerciseDemo = {
  frames: readonly string[];
  source?: { name: string; href: string };
  note?: string;
  equipmentLink?: string;
};

function normalize(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const catalogIds = new Map<string, CatalogId>();
const catalogNames = new Map<string, CatalogId | null>();
for (const id of Object.keys(catalog) as CatalogId[]) {
  catalogIds.set(encodeURIComponent(id), id);
  const key = normalize(catalog[id]);
  catalogNames.set(key, catalogNames.has(key) ? null : id);
}

function catalogPhotos(id: CatalogId, note?: string, equipmentLink?: string): ExerciseDemo {
  const root = `${catalogRoot}/${encodeURIComponent(id)}`;
  return {
    frames: [`${root}/0.jpg`, `${root}/1.jpg`],
    source: { name: "Free Exercise DB", href: `${repository}/tree/${revision}/exercises/${encodeURIComponent(id)}` },
    note,
    equipmentLink,
  };
}

function artwork(id: string, note?: string, source?: ExerciseDemo["source"], equipmentLink?: string): ExerciseDemo {
  return {
    frames: [`/exercise-demos/${id}-0.webp`, `/exercise-demos/${id}-1.webp`],
    source,
    note,
    equipmentLink,
  };
}

const openIllustrations = { name: "Open Exercise Illustrations (CC0)", href: illustrationSource };
const machineNote = "The demo shows the same movement on a different machine. Use the seat and handle settings on your machine.";
const inclineMachine = artwork("plate-loaded-incline-chest-press", machineNote, openIllustrations);
const flatMachine = artwork("chest-press-machine", machineNote, openIllustrations);
const overheadMachine = artwork("shoulder-press-machine", machineNote, openIllustrations);
const lateralMachine = artwork("machine-lateral-raise", machineNote, openIllustrations);
const pecDeck = artwork("pec-deck", machineNote, openIllustrations);
const preacherMachine = catalogPhotos("Machine_Preacher_Curls", machineNote);
const tricepsPress = catalogPhotos("Triceps_Pushdown");
const highCableFly = artwork("cable-fly-high-to-low", undefined, openIllustrations);
const loadedCalf = artwork("supported-loaded-calf-raise", "Hold the weight in one hand and use the other hand for balance.");
const tBarRow = artwork("chest-supported-t-bar-row", undefined, openIllustrations);
const isoRow = catalogPhotos("Leverage_Iso_Row", machineNote, "https://www.lifefitness.com/en-us/catalog/strength-training/plate-loaded/plate-loaded-iso-lateral-low-row");

const aliases = new Map(Object.entries({
  "Ab Wheel Rollout": catalogPhotos("Ab_Roller"),
  "Back Squat": catalogPhotos("Barbell_Full_Squat"),
  "Barbell Back Squat": catalogPhotos("Barbell_Full_Squat"),
  "Barbell Bench Press": catalogPhotos("Barbell_Bench_Press_-_Medium_Grip"),
  "Barbell Bent-Over Row": catalogPhotos("Bent_Over_Barbell_Row"),
  "Barbell Romanian Deadlift": catalogPhotos("Romanian_Deadlift"),
  "Barbell Row": catalogPhotos("Bent_Over_Barbell_Row"),
  "Bench Press": catalogPhotos("Barbell_Bench_Press_-_Medium_Grip"),
  "Bulgarian Split Squat": catalogPhotos("Split_Squat_with_Dumbbells"),
  "Cable Flies (Up to Bottom)": highCableFly,
  "Cable Fly (High-to-Low)": highCableFly,
  "Cable Fly (Low-to-High)": catalogPhotos("Low_Cable_Crossover"),
  "Cable Lateral Raise": catalogPhotos("Standing_Low-Pulley_Deltoid_Raise"),
  "Cable Lateral Raises": catalogPhotos("Standing_Low-Pulley_Deltoid_Raise"),
  "Cable Pullover": catalogPhotos("Rope_Straight-Arm_Pulldown"),
  "Cable Triceps Pushdown": tricepsPress,
  "Chest-Supported Row - Elbows Out": catalogPhotos("Leverage_Iso_Row", "The demo shows the supported row setup. Use a comfortable wider elbow path for this variation."),
  "Chest-Supported Row - Elbows Tucked": catalogPhotos("Leverage_Iso_Row", "The demo shows the supported row setup. Keep your elbows closer to your sides for this variation."),
  "Chest-Supported T-Bar Row": tBarRow,
  "Cross-Cable Reverse Fly": catalogPhotos("Cable_Rear_Delt_Fly"),
  "Deadlift": catalogPhotos("Barbell_Deadlift"),
  "Dumbbell Hammer Curl": catalogPhotos("Hammer_Curls"),
  "Dumbbell Lateral Raise": catalogPhotos("Side_Lateral_Raise"),
  "Dumbbell Walking Lunge (Per Hand)": catalogPhotos("Dumbbell_Lunges", "Hold a dumbbell at each side. Step through into the next lunge."),
  "EZ-Bar Skull Crusher": catalogPhotos("EZ-Bar_Skullcrusher"),
  "Flat Machine Chest Press": flatMachine,
  "Gym80 Butterfly Dual": { ...pecDeck, equipmentLink: "https://gym80.de/en/product/4341/" },
  "Gym80 Lateral Raise Dual": { ...lateralMachine, equipmentLink: "https://gym80.de/en/product/4325/" },
  "Gym80 Overhead Triceps Machine": catalogPhotos("Machine_Triceps_Extension", machineNote, "https://gym80.de/en/product/4379/"),
  "Gym80 Preacher Curl": preacherMachine,
  "Hammer Curl": catalogPhotos("Hammer_Curls"),
  "Hammer Strength Abdominal Crunch": catalogPhotos("Ab_Crunch_Machine", machineNote, "https://www.lifefitness.com/en-us/catalog/strength-training/plate-loaded/plate-loaded-abdominal-oblique-crunch"),
  "Hammer Strength Iso-Lateral Low Row": isoRow,
  "Hammer Strength Shoulder Press": { ...overheadMachine, equipmentLink: "https://www.lifefitness.com/en-us/catalog/strength-training/plate-loaded/plate-loaded-iso-lateral-shoulder-press" },
  "Hanging Knee Raise": artwork("hanging-knee-raise", undefined, openIllustrations),
  "Hip Thrust": catalogPhotos("Barbell_Hip_Thrust"),
  "Horizontal Chest Press Machine": flatMachine,
  "Incline Dumbbell Bench Press": catalogPhotos("Incline_Dumbbell_Press"),
  "Incline Machine Chest Press": inclineMachine,
  "Incline Machine Press": inclineMachine,
  "Lat Pulldown": catalogPhotos("Wide-Grip_Lat_Pulldown"),
  "Lateral Raise": catalogPhotos("Side_Lateral_Raise"),
  "Leg Curl": catalogPhotos("Lying_Leg_Curls", "Lying machine shown. Check your routine’s setup for this exercise."),
  "Leg Extension": catalogPhotos("Leg_Extensions"),
  "Leg Press (High Foot Placement)": artwork("high-foot-leg-press", "Place your feet higher on the platform and keep your pelvis supported."),
  "Lying Leg Curl": catalogPhotos("Lying_Leg_Curls"),
  "Machine Hip Thrust": artwork("hip-thrust-machine", machineNote, openIllustrations),
  "Machine Lateral Raise": lateralMachine,
  "Machine Preacher Curl": preacherMachine,
  "Machine Shoulder Press": overheadMachine,
  "Overhead Cable Tricep Extension": catalogPhotos("Cable_Rope_Overhead_Triceps_Extension"),
  "Overhead Cable Triceps Extension": catalogPhotos("Cable_Rope_Overhead_Triceps_Extension"),
  "Overhead Press": catalogPhotos("Standing_Military_Press"),
  "Pec Deck": pecDeck,
  "Prone Incline Dumbbell Rear Delt Fly": artwork("prone-incline-rear-delt-fly", "Keep your chest on the incline bench. Raise the dumbbells out to your sides."),
  "Pull-up": catalogPhotos("Pullups"),
  "Push-up": catalogPhotos("Pushups"),
  "Reverse Pec Deck": catalogPhotos("Reverse_Machine_Flyes"),
  "Rope Triceps Pushdown": catalogPhotos("Triceps_Pushdown_-_Rope_Attachment"),
  "Single-Arm Dumbbell Row": catalogPhotos("One-Arm_Dumbbell_Row"),
  "Single-Arm Overhead Cable Extension": artwork("single-arm-overhead-cable-extension", "Keep your upper arm steady and move through the elbow."),
  "Standing Barbell Overhead Press": catalogPhotos("Standing_Military_Press"),
  "Standing Calf Raise": catalogPhotos("Standing_Calf_Raises"),
  "Supported Loaded Single Leg Calf Raise": loadedCalf,
  "Weighted Pull-Up": catalogPhotos("Weighted_Pull_Ups"),
}).map(([name, demo]) => [normalize(name), demo]));

function catalogIdFromImage(imageUrl: string | null) {
  if (!imageUrl) return null;
  const match = /^https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/[\w.-]+\/exercises\/([^/?#]+)\/[01]\.jpg$/.exec(imageUrl);
  if (!match) return null;
  return catalogIds.get(match[1]);
}

export function exerciseDemo(name: string, imageUrl: string | null): ExerciseDemo | null {
  // A display label may include a gym qualifier. Keep all other variant qualifiers.
  const baseName = name.replace(/\s*\([^()]*\bgym\b[^()]*\)\s*$/i, "");
  const key = normalize(baseName);
  const curated = aliases.get(key);
  if (curated) return curated;
  const id = catalogIdFromImage(imageUrl) ?? catalogNames.get(key);
  return id ? catalogPhotos(id) : null;
}
