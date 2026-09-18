/**
 * The zoo, the zookeeper and the star. Flat inline SVG — no gradients, no
 * external files, no requests.
 *
 * Redrawn Sept 16 for the child screen's saturated, illustration-led direction
 * (see the decisions log). Every animal is a whole animal — body, legs, tail,
 * markings — standing on a common baseline near y=58 inside a 0 0 64 64 box, so
 * a row of them sits on the grass without per-animal nudging.
 */

type AnimalProps = { size?: number; title?: string };

/** Earned stars are this. Exported so a test can count them without a literal. */
export const STAR_AMBER = "#F5A623";

/** Unearned stars: a soft filled shape, never a hollow outline. */
export const STAR_EMPTY = "#E3D9C6";

/**
 * Okabe-Ito, the colourblind-safe palette DESIGN.md section 7 specifies.
 * The most saturated of these are reserved for interactive elements, so the
 * eye lands on the word cards rather than on the scenery.
 */
export const OKABE_ITO = {
   orange: "#E69F00",
   skyBlue: "#56B4E9",
   bluishGreen: "#009E73",
   blue: "#0072B2",
   vermillion: "#D55E00",
   reddishPurple: "#CC79A7",
   yellow: "#F0E442",
} as const;

const box = (size: number) => ({
   width: size,
   height: size,
   viewBox: "0 0 64 64",
   xmlns: "http://www.w3.org/2000/svg",
});

const INK = "#3B2F26";

/*
 * Each animal is a whole, characterful figure — body, legs, tail, markings, a
 * face — in a 0 0 64 64 box with its feet near y=58, so a row of them stands on
 * the same ground line. Eyes carry `className="eye"` so an owned animal can
 * blink (see `.figure--live .eye` in styles.css); nothing else about the drawing
 * moves.
 */

function Lion({ size = 48, title = "Lion" }: AnimalProps) {
   return (
      <svg {...box(size)} role="img" aria-label={title}>
         {/* tail, with a tuft */}
         <path d="M52 40 q9 -3 8 -13" stroke="#D9862B" strokeWidth="3" fill="none" strokeLinecap="round" />
         <ellipse cx="60" cy="26" rx="3.4" ry="4.2" fill="#8A5A32" />
         {/* back legs */}
         <rect x="41" y="44" width="7" height="14" rx="3.5" fill="#D9862B" />
         <ellipse cx="44.5" cy="58" rx="4.4" ry="2.2" fill="#C4762A" />
         {/* body */}
         <ellipse cx="37" cy="42" rx="18" ry="12" fill="#E9A23B" />
         <ellipse cx="40" cy="47" rx="11" ry="6" fill="#F4C36A" />
         {/* front legs */}
         <rect x="24" y="45" width="7" height="13" rx="3.5" fill="#E9A23B" />
         <rect x="32" y="46" width="7" height="12" rx="3.5" fill="#E9A23B" />
         <ellipse cx="27.5" cy="58" rx="4.4" ry="2.2" fill="#D9862B" />
         <ellipse cx="35.5" cy="58" rx="4.4" ry="2.2" fill="#D9862B" />
         {/* mane: two layers, spiky outer */}
         <path
            d="M22 6 l4 5 5 -4 2 6 6 -1 -1 6 6 2 -4 5 5 4 -6 3 3 6 -6 -1 0 6 -6 -3 -3 6 -4 -5 -6 3 0 -6 -6 1 3 -6 -6 -3 5 -4 -4 -5 6 -2 -1 -6 6 1 z"
            fill="#B8651F"
         />
         <circle cx="23" cy="25" r="14" fill="#D9862B" />
         {/* head */}
         <circle cx="23" cy="26" r="10.5" fill="#F2B54D" />
         <circle cx="14.5" cy="16.5" r="3.6" fill="#D9862B" />
         <circle cx="31.5" cy="16.5" r="3.6" fill="#D9862B" />
         <circle cx="14.5" cy="16.5" r="1.8" fill="#F4C36A" />
         <circle cx="31.5" cy="16.5" r="1.8" fill="#F4C36A" />
         {/* face */}
         <circle className="eye" cx="19" cy="25" r="1.9" fill={INK} />
         <circle className="eye" cx="27" cy="25" r="1.9" fill={INK} />
         <ellipse cx="23" cy="31" rx="5.6" ry="4" fill="#FFE0B0" />
         <path d="M23 28.5 l-2.4 2.2 h4.8 z" fill={INK} />
         <path d="M23 30.7 v1.6 M20.6 33 q2.4 1.6 4.8 0" stroke={INK} strokeWidth="1.2" fill="none" strokeLinecap="round" />
         <path d="M14 30 l4 .6 M14 32.4 l4 -.4 M32 30 l-4 .6 M32 32.4 l-4 -.4" stroke="#B8651F" strokeWidth=".9" strokeLinecap="round" />
      </svg>
   );
}

function Elephant({ size = 48, title = "Elephant" }: AnimalProps) {
   return (
      <svg {...box(size)} role="img" aria-label={title}>
         {/* tail */}
         <path d="M55 36 q5 5 2 12" stroke="#7F92A6" strokeWidth="2.6" fill="none" strokeLinecap="round" />
         {/* back legs */}
         <rect x="40" y="44" width="8" height="14" rx="3.5" fill="#8DA0B4" />
         <rect x="49" y="44" width="7" height="14" rx="3.5" fill="#7F92A6" />
         {/* body */}
         <ellipse cx="38" cy="38" rx="20" ry="14" fill="#9DB0C3" />
         {/* front legs with toenails */}
         <rect x="22" y="45" width="8" height="13" rx="3.5" fill="#9DB0C3" />
         <rect x="31" y="46" width="8" height="12" rx="3.5" fill="#8DA0B4" />
         <circle cx="24" cy="57.5" r="1.1" fill="#EDF1F5" />
         <circle cx="27.5" cy="57.5" r="1.1" fill="#EDF1F5" />
         <circle cx="33" cy="57.5" r="1.1" fill="#EDF1F5" />
         <circle cx="36.5" cy="57.5" r="1.1" fill="#EDF1F5" />
         {/* head, ear behind, trunk in front */}
         <circle cx="19" cy="30" r="12.5" fill="#A6B8CA" />
         <ellipse cx="27" cy="29" rx="8.5" ry="11.5" fill="#7F92A6" />
         <ellipse cx="27.5" cy="29" rx="5.5" ry="8.5" fill="#B9C6D5" />
         <path
            d="M10 37 q-5 6 -3 13 q1 4 5 4 q4 0 3 -4 q-3 -6 0 -11 z"
            fill="#A6B8CA"
         />
         <path d="M8 46 q1 2 4 2" stroke="#7F92A6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
         <path d="M14 39 q4 3 4 8" stroke="#F5F2E8" strokeWidth="2.6" fill="none" strokeLinecap="round" />
         <circle className="eye" cx="15" cy="27" r="1.9" fill={INK} />
         <path d="M12 24 q2 -1.5 4 0" stroke={INK} strokeWidth=".9" fill="none" strokeLinecap="round" />
      </svg>
   );
}

function Giraffe({ size = 48, title = "Giraffe" }: AnimalProps) {
   return (
      <svg {...box(size)} role="img" aria-label={title}>
         {/* tail */}
         <path d="M49 40 q6 3 6 10" stroke="#D9A23D" strokeWidth="2.2" fill="none" strokeLinecap="round" />
         <ellipse cx="55.5" cy="51" rx="2.2" ry="3" fill="#8A5A32" />
         {/* legs, long */}
         <rect x="24" y="42" width="5" height="16" rx="2.5" fill="#D9A23D" />
         <rect x="31" y="42" width="5" height="16" rx="2.5" fill="#F0C05A" />
         <rect x="40" y="42" width="5" height="16" rx="2.5" fill="#D9A23D" />
         <rect x="46" y="42" width="5" height="16" rx="2.5" fill="#F0C05A" />
         <rect x="24" y="55" width="5" height="3" rx="1.2" fill="#8A5A32" />
         <rect x="31" y="55" width="5" height="3" rx="1.2" fill="#8A5A32" />
         <rect x="40" y="55" width="5" height="3" rx="1.2" fill="#8A5A32" />
         <rect x="46" y="55" width="5" height="3" rx="1.2" fill="#8A5A32" />
         {/* body */}
         <ellipse cx="37" cy="40" rx="16" ry="9" fill="#F0C05A" />
         {/* neck, with mane ridge */}
         <path d="M25 40 q-5 -10 -6 -24 l9 -2 q-1 14 5 24 z" fill="#F0C05A" />
         <path d="M19.5 15 q-1 12 4 23" stroke="#B9742E" strokeWidth="2.4" fill="none" strokeDasharray="2.2 2.2" strokeLinecap="round" />
         {/* head */}
         <ellipse cx="20" cy="11" rx="9.5" ry="6.5" fill="#F0C05A" />
         <ellipse cx="12" cy="12.5" rx="4" ry="3" fill="#E3B24F" />
         <rect x="19" y="1.5" width="2.6" height="6" rx="1.3" fill="#B9742E" />
         <rect x="24.5" y="1.5" width="2.6" height="6" rx="1.3" fill="#B9742E" />
         <circle cx="20.3" cy="1.8" r="1.8" fill="#8A5A32" />
         <circle cx="25.8" cy="1.8" r="1.8" fill="#8A5A32" />
         <ellipse cx="29" cy="8" rx="3.2" ry="2" fill="#E3B24F" transform="rotate(-25 29 8)" />
         <circle className="eye" cx="15.5" cy="9.5" r="1.7" fill={INK} />
         <circle cx="10.5" cy="13.5" r=".9" fill="#8A5A32" />
         {/* patches */}
         <path d="M31 35 l5 -3 5 2 -1 5 -5 2 -4 -3 z" fill="#B9742E" />
         <path d="M41 38 l4 -2 4 3 -2 4 -5 0 z" fill="#B9742E" />
         <path d="M33 44 l4 -1 2 3 -3 2 -3 -1 z" fill="#B9742E" />
         <path d="M22 26 l3 -1 2 3 -2 2 -3 -1 z" fill="#B9742E" />
         <path d="M20 18 l3 -1 1 3 -3 1 z" fill="#B9742E" />
      </svg>
   );
}

function Penguin({ size = 48, title = "Penguin" }: AnimalProps) {
   return (
      <svg {...box(size)} role="img" aria-label={title}>
         {/* feet */}
         <ellipse cx="25" cy="57.5" rx="7" ry="3" fill="#F5A623" />
         <ellipse cx="39" cy="57.5" rx="7" ry="3" fill="#F5A623" />
         <path d="M20 57 h4 M23 57 h4 M34 57 h4 M37 57 h4" stroke="#D9862B" strokeWidth="1" strokeLinecap="round" />
         {/* body */}
         <ellipse cx="32" cy="34" rx="17" ry="22" fill="#2F3A4A" />
         <ellipse cx="32" cy="38" rx="11" ry="16" fill="#FFFDF5" />
         {/* flippers */}
         <ellipse cx="14" cy="35" rx="4.5" ry="12" fill="#232C39" transform="rotate(12 14 35)" />
         <ellipse cx="50" cy="35" rx="4.5" ry="12" fill="#232C39" transform="rotate(-12 50 35)" />
         {/* face */}
         <ellipse cx="26.5" cy="24" rx="5" ry="5.5" fill="#FFFDF5" />
         <ellipse cx="37.5" cy="24" rx="5" ry="5.5" fill="#FFFDF5" />
         <circle className="eye" cx="27.5" cy="24" r="1.9" fill={INK} />
         <circle className="eye" cx="36.5" cy="24" r="1.9" fill={INK} />
         <circle cx="28.2" cy="23.3" r=".6" fill="#FFFDF5" />
         <circle cx="37.2" cy="23.3" r=".6" fill="#FFFDF5" />
         <path d="M32 28 l-4.5 3.5 h9 z" fill="#F5A623" />
         <path d="M27.5 31.5 h9" stroke="#D9862B" strokeWidth=".8" />
         <ellipse cx="24" cy="30" rx="2.4" ry="1.4" fill="#F2A0A0" opacity=".55" />
         <ellipse cx="40" cy="30" rx="2.4" ry="1.4" fill="#F2A0A0" opacity=".55" />
      </svg>
   );
}

function Turtle({ size = 48, title = "Turtle" }: AnimalProps) {
   return (
      <svg {...box(size)} role="img" aria-label={title}>
         {/* legs and tail */}
         <ellipse cx="20" cy="53" rx="6" ry="4" fill="#7BC98F" transform="rotate(-20 20 53)" />
         <ellipse cx="46" cy="53" rx="6" ry="4" fill="#7BC98F" transform="rotate(20 46 53)" />
         <path d="M52 44 q6 0 8 5" stroke="#7BC98F" strokeWidth="3" fill="none" strokeLinecap="round" />
         {/* head */}
         <circle cx="13" cy="41" r="8" fill="#7BC98F" />
         <circle className="eye" cx="10.5" cy="39" r="1.8" fill={INK} />
         <path d="M8 44 q3 2.4 6.5 0" stroke={INK} strokeWidth="1.2" fill="none" strokeLinecap="round" />
         <circle cx="6.5" cy="41.5" r=".8" fill="#3E9A62" />
         {/* shell: rim, dome, scutes */}
         <ellipse cx="34" cy="48" rx="23" ry="6" fill="#2F7B4C" />
         <path d="M12 47 a22 18 0 0 1 44 0 z" fill="#3E9A62" />
         <path d="M34 30 l7 4 -3 9 h-8 l-3 -9 z" fill="#7BC98F" />
         <path d="M20 40 l6 -6 4 4 -3 9 h-6 z" fill="#5FB27A" />
         <path d="M48 40 l-6 -6 -4 4 3 9 h6 z" fill="#5FB27A" />
         <path d="M27 33 l7 -4 7 4" stroke="#2F7B4C" strokeWidth="1.2" fill="none" />
         <path d="M12 47 a22 18 0 0 1 44 0" fill="none" stroke="#2F7B4C" strokeWidth="1.8" />
      </svg>
   );
}

function Monkey({ size = 48, title = "Monkey" }: AnimalProps) {
   return (
      <svg {...box(size)} role="img" aria-label={title}>
         {/* tail */}
         <path d="M44 46 q13 0 12 -12 q-1 -6 -7 -5" stroke="#8A5A32" strokeWidth="3" fill="none" strokeLinecap="round" />
         {/* legs, feet */}
         <ellipse cx="24" cy="55" rx="6" ry="3.2" fill="#8A5A32" />
         <ellipse cx="40" cy="55" rx="6" ry="3.2" fill="#8A5A32" />
         {/* body */}
         <ellipse cx="32" cy="44" rx="13" ry="11" fill="#A9743F" />
         <ellipse cx="32" cy="46" rx="8" ry="7" fill="#E8C9A8" />
         {/* arms */}
         <path d="M20 40 q-6 6 -2 13" stroke="#A9743F" strokeWidth="5" fill="none" strokeLinecap="round" />
         <path d="M44 40 q6 6 2 13" stroke="#A9743F" strokeWidth="5" fill="none" strokeLinecap="round" />
         <circle cx="17" cy="53" r="2.6" fill="#8A5A32" />
         <circle cx="47" cy="53" r="2.6" fill="#8A5A32" />
         {/* head, ears, face */}
         <circle cx="18" cy="25" r="5.6" fill="#A9743F" />
         <circle cx="46" cy="25" r="5.6" fill="#A9743F" />
         <circle cx="18" cy="25" r="3" fill="#E8C9A8" />
         <circle cx="46" cy="25" r="3" fill="#E8C9A8" />
         <circle cx="32" cy="25" r="13.5" fill="#A9743F" />
         <path d="M27 12 q2 -4 5 -1 q3 -3 5 1" stroke="#8A5A32" strokeWidth="2" fill="none" strokeLinecap="round" />
         <path d="M20 26 a12 9 0 0 0 24 0 a9 9 0 0 0 -24 0 z" fill="#F1D2B0" />
         <circle className="eye" cx="27.5" cy="24" r="2" fill={INK} />
         <circle className="eye" cx="36.5" cy="24" r="2" fill={INK} />
         <ellipse cx="30" cy="29" rx="1.3" ry="1.8" fill="#7A4F2C" />
         <ellipse cx="34" cy="29" rx="1.3" ry="1.8" fill="#7A4F2C" />
         <path d="M27.5 32.5 q4.5 3.5 9 0" stroke="#7A4F2C" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
   );
}

/**
 * One animal at whatever size the pen gives it, faded when it has not been
 * bought yet. A silhouette of the real drawing, not a grey blob: the child has
 * to want the specific animal.
 */
export function AnimalFigure({
   kind,
   size,
   ghost = false,
}: {
   kind: (typeof ANIMALS)[number]["id"];
   size: number;
   ghost?: boolean;
}) {
   const entry = ANIMALS.find((a) => a.id === kind);
   if (!entry) return null;
   const { name, Draw } = entry;
   return (
      <span className={ghost ? "figure figure--ghost" : "figure figure--live"}>
         {/* Walk-in lives on the outer span; the idle sway on this inner one. */}
         <span className="figure__body">
            <Draw size={size} title={ghost ? `${name}, not yet` : name} />
         </span>
      </span>
   );
}

/** The roster, in the order a child collects them. */
export const ANIMALS = [
   { id: "lion", name: "Lion", Draw: Lion },
   { id: "elephant", name: "Elephant", Draw: Elephant },
   { id: "giraffe", name: "Giraffe", Draw: Giraffe },
   { id: "penguin", name: "Penguin", Draw: Penguin },
   { id: "turtle", name: "Turtle", Draw: Turtle },
   { id: "monkey", name: "Monkey", Draw: Monkey },
] as const;

/**
 * The zookeeper. Greets the child at the top of every screen and does nothing
 * else — no speech, no reaction to answers, because a character that responds to
 * a tap is a verdict however kindly it is drawn.
 */
export function Zookeeper({ size = 86 }: { size?: number }) {
   return (
      <svg
         width={size}
         height={size}
         viewBox="0 0 64 64"
         xmlns="http://www.w3.org/2000/svg"
         role="img"
         aria-label="Your zookeeper"
      >
         <path d="M18 62 q0 -18 14 -18 q14 0 14 18 z" fill="#6FA96B" />
         <path d="M26 45 h12 v6 q-6 4 -12 0 z" fill="#5C9159" />
         <rect x="30" y="47" width="4" height="15" rx="2" fill="#4F7F4D" />
         <circle cx="20" cy="52" r="4.2" fill="#6FA96B" />
         <circle cx="44" cy="52" r="4.2" fill="#6FA96B" />
         <circle cx="18" cy="56" r="3.6" fill="#F0C9A4" />
         <circle cx="46" cy="56" r="3.6" fill="#F0C9A4" />
         <rect x="26" y="38" width="12" height="8" rx="4" fill="#F0C9A4" />
         <circle cx="32" cy="27" r="14" fill="#F7D6B0" />
         <ellipse cx="32" cy="16" rx="20" ry="4.5" fill="#C98B4B" />
         <path d="M20 17 q0 -11 12 -11 q12 0 12 11 z" fill="#E0A85C" />
         <rect x="20" y="14" width="24" height="3.4" rx="1.7" fill="#8A5A32" />
         <circle cx="27" cy="27" r="2.2" fill={INK} />
         <circle cx="37" cy="27" r="2.2" fill={INK} />
         <path d="M27 33 q5 4 10 0" stroke={INK} strokeWidth="1.9" fill="none" strokeLinecap="round" />
         <circle cx="23" cy="31" r="2.4" fill="#F2A0A0" opacity="0.55" />
         <circle cx="41" cy="31" r="2.4" fill="#F2A0A0" opacity="0.55" />
      </svg>
   );
}

/**
 * The store: what the stars are for. Drawn, never tapped — see the zoo footer
 * and the decisions log.
 */
export function StoreIcon({ size = 30 }: { size?: number }) {
   return (
      <svg
         width={size}
         height={size}
         viewBox="0 0 64 64"
         xmlns="http://www.w3.org/2000/svg"
         aria-hidden="true"
      >
         <rect x="12" y="28" width="40" height="26" rx="4" fill="#F0E3CC" />
         <path d="M8 28 h48 l-4 -12 h-40 z" fill="#E8613C" />
         <path d="M20 16 l-2 12 M32 16 v12 M44 16 l2 12" stroke="#FFF6E8" strokeWidth="2.6" />
         <rect x="26" y="38" width="12" height="16" rx="2" fill="#C98B4B" />
         <circle cx="35" cy="46" r="1.4" fill="#F0E3CC" />
      </svg>
   );
}

/**
 * One star. Filled means an item was answered — not answered *correctly*.
 * Section 9: progress is position only, and never encodes right or wrong.
 */
export function Star({ filled, size = 20 }: { filled: boolean; size?: number }) {
   return (
      <svg
         width={size}
         height={size}
         viewBox="0 0 24 24"
         xmlns="http://www.w3.org/2000/svg"
         aria-hidden="true"
      >
         <path
            d="M12 2.6 l2.9 6.1 6.6 .9 -4.8 4.7 1.2 6.7 -5.9 -3.2 -5.9 3.2 1.2 -6.7 -4.8 -4.7 6.6 -.9 z"
            fill={filled ? STAR_AMBER : STAR_EMPTY}
         />
      </svg>
   );
}

/* -- habitats ---------------------------------------------------------------- */

/** Four pens that read as places, not four identical fences. */
export type Habitat = "grass" | "water" | "rock" | "trees";

export const HABITATS: Record<(typeof ANIMALS)[number]["id"], Habitat> = {
   lion: "grass",
   elephant: "water",
   giraffe: "trees",
   penguin: "rock",
   turtle: "water",
   monkey: "trees",
};

/** The ground of a pen, drawn behind whoever stands in it. */
export function PenGround({ kind }: { kind: Habitat }) {
   const common = { className: "pen__ground", viewBox: "0 0 300 120", preserveAspectRatio: "none" as const, "aria-hidden": true as const };
   switch (kind) {
      case "grass":
         return (
            <svg {...common}>
               <ellipse cx="150" cy="96" rx="140" ry="22" fill="#9BD07A" />
               {[40, 90, 205, 250].map((x) => (
                  <path key={x} d={`M${x} 98 l3 -9 l3 9 M${x + 5} 99 l2 -7 l3 7`} stroke="#5F9A46" strokeWidth="2" fill="none" strokeLinecap="round" />
               ))}
            </svg>
         );
      case "water":
         return (
            <svg {...common}>
               <ellipse cx="150" cy="96" rx="142" ry="22" fill="#B48B5E" />
               <ellipse cx="150" cy="96" rx="122" ry="16" fill="#56B4E9" />
               <ellipse cx="150" cy="95" rx="100" ry="10" fill="#7FCCF2" />
               <path d="M70 94 q12 -4 24 0 M180 92 q12 -4 24 0 M120 100 q10 -3 20 0" stroke="#EAF7FD" strokeWidth="2" fill="none" strokeLinecap="round" />
               <circle cx="230" cy="99" r="4" fill="#A98764" />
               <circle cx="60" cy="102" r="3" fill="#A98764" />
            </svg>
         );
      case "rock":
         return (
            <svg {...common}>
               <ellipse cx="150" cy="96" rx="142" ry="22" fill="#B9C3CC" />
               <ellipse cx="150" cy="94" rx="118" ry="14" fill="#D7DEE4" />
               <path d="M40 90 q10 -16 26 -4 q6 6 -2 10 z" fill="#8E9BA7" />
               <path d="M228 86 q14 -14 32 0 q4 6 -4 10 h-26 z" fill="#8E9BA7" />
               <path d="M54 83 q6 -5 12 -1" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" />
               <path d="M240 79 q8 -5 16 -1" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
         );
      case "trees":
         return (
            <svg {...common}>
               <ellipse cx="150" cy="96" rx="142" ry="22" fill="#7BB25F" />
               {[{ x: 40, s: 1 }, { x: 258, s: 1.1 }, { x: 118, s: 0.75 }].map(({ x, s: sc }) => (
                  <g key={x} transform={`translate(${x},70) scale(${sc})`}>
                     <rect x="-4" y="-2" width="8" height="30" rx="3" fill="#8A6034" />
                     <circle cx="0" cy="-16" r="22" fill="#4E8F3C" />
                     <circle cx="-16" cy="-4" r="14" fill="#5EA34A" />
                     <circle cx="16" cy="-6" r="13" fill="#5EA34A" />
                  </g>
               ))}
            </svg>
         );
   }
}

/** A pen's boundary, drawn in front of whoever is standing in it. */
export function PenFence({ kind }: { kind: Habitat }) {
   const common = { className: "pen__fence", viewBox: "0 0 300 96", preserveAspectRatio: "none" as const, "aria-hidden": true as const };
   switch (kind) {
      case "grass":
         return (
            <svg {...common}>
               {[0, 1, 2, 3, 4, 5].map((i) => (
                  <rect key={i} x={12 + i * 55} y="14" width="8" height="82" rx="4" fill="#C08E5E" />
               ))}
               <rect x="6" y="34" width="288" height="8" rx="4" fill="#D6A876" />
               <rect x="6" y="62" width="288" height="8" rx="4" fill="#D6A876" />
            </svg>
         );
      case "water":
         return (
            <svg {...common}>
               <rect x="4" y="66" width="292" height="22" rx="11" fill="#E4D8C2" />
               <rect x="4" y="66" width="292" height="8" rx="4" fill="#F1E9DA" />
               <circle cx="40" cy="80" r="5" fill="#CBBDA3" />
               <circle cx="150" cy="82" r="4" fill="#CBBDA3" />
               <circle cx="256" cy="79" r="5" fill="#CBBDA3" />
            </svg>
         );
      case "rock":
         return (
            <svg {...common}>
               {[
                  [8, 70, 62], [76, 70, 74], [156, 70, 66], [228, 70, 64],
                  [30, 50, 70], [108, 50, 80], [196, 50, 76],
               ].map(([x, y, w], i) => (
                  <rect key={i} x={x} y={y} width={w} height="20" rx="8" fill={i % 2 ? "#9AA6B1" : "#B4BEC7"} stroke="#7C8893" strokeWidth="1.5" />
               ))}
            </svg>
         );
      case "trees":
         return (
            <svg {...common}>
               {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <circle key={i} cx={20 + i * 33} cy="76" r="17" fill={i % 2 ? "#4E8F3C" : "#5EA34A"} />
               ))}
               <rect x="6" y="42" width="288" height="7" rx="3.5" fill="#C08E5E" />
               <rect x="30" y="30" width="7" height="50" rx="3.5" fill="#A87A4C" />
               <rect x="263" y="30" width="7" height="50" rx="3.5" fill="#A87A4C" />
            </svg>
         );
   }
}
