// Flat product drawings for the demo catalog. They stand in for product
// photography (which a real store would upload) and share one graphic
// language: solid fills, no outlines, no gradients, one object per frame.
import sharp from "sharp";

export type ArtKind =
  | "bag"
  | "mug"
  | "dripper"
  | "carafe"
  | "grinder"
  | "giftbox"
  | "tee"
  | "crewneck"
  | "shirt"
  | "jacket"
  | "chino"
  | "tote"
  | "beanie"
  | "cap";

export type ProductArt = {
  kind: ArtKind;
  /** Background field. */
  ground: string;
  /** Main colour of the object. */
  body: string;
  /** Secondary colour: the label, a band, a lid. */
  detail: string;
  /** For coffee bags: the two lines printed on the label. */
  label?: [string, string];
};

const SIZE = 1000;

function escapeXml(text: string): string {
  return text.replace(
    /[<>&"']/g,
    (character) => `&#${character.charCodeAt(0)};`,
  );
}

// Each drawing is centred in a 1000 × 1000 frame and leaves room around the
// object, like a product shot on a plain backdrop.
const drawings: Record<ArtKind, (art: ProductArt) => string> = {
  bag: ({ body, detail, ground, label }) => {
    const [line1, line2] = label ?? ["", ""];
    return `
      <path d="M330 250 L670 250 L700 820 L300 820 Z" fill="${body}"/>
      <rect x="330" y="222" width="340" height="40" fill="${body}"/>
      <rect x="330" y="262" width="340" height="14" fill="${ground}" opacity="0.25"/>
      <rect x="372" y="420" width="256" height="300" fill="${detail}"/>
      <text x="500" y="560" text-anchor="middle" font-family="Georgia, serif" font-size="40" fill="${body}">${escapeXml(line1)}</text>
      <rect x="430" y="590" width="140" height="4" fill="${body}"/>
      <text x="500" y="640" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="${body}">${escapeXml(line2)}</text>`;
  },
  mug: ({ body, detail }) => `
      <path d="M640 430 h60 a80 80 0 0 1 0 160 h-60 v-44 h52 a36 36 0 0 0 0 -72 h-52 Z" fill="${body}"/>
      <rect x="300" y="380" width="360" height="380" fill="${body}"/>
      <rect x="300" y="380" width="360" height="40" fill="${detail}"/>`,
  dripper: ({ body, detail }) => `
      <path d="M300 340 L700 340 L580 640 L420 640 Z" fill="${body}"/>
      <rect x="360" y="640" width="280" height="40" fill="${body}"/>
      <rect x="300" y="340" width="400" height="30" fill="${detail}"/>
      <rect x="440" y="680" width="120" height="120" fill="${detail}" opacity="0.6"/>`,
  carafe: ({ body, detail }) => `
      <path d="M430 260 h140 v140 l90 160 a90 90 0 0 1 -80 140 h-160 a90 90 0 0 1 -80 -140 l90 -160 Z" fill="${body}"/>
      <rect x="410" y="400" width="180" height="48" fill="${detail}"/>`,
  grinder: ({ body, detail }) => `
      <rect x="400" y="380" width="200" height="380" fill="${body}"/>
      <rect x="420" y="320" width="160" height="60" fill="${detail}"/>
      <rect x="490" y="250" width="20" height="80" fill="${detail}"/>
      <rect x="490" y="250" width="190" height="20" fill="${detail}"/>
      <circle cx="680" cy="260" r="26" fill="${body}"/>`,
  giftbox: ({ body, detail }) => `
      <rect x="290" y="440" width="420" height="320" fill="${body}"/>
      <rect x="270" y="380" width="460" height="80" fill="${body}"/>
      <rect x="475" y="380" width="50" height="380" fill="${detail}"/>
      <path d="M500 380 C440 300 380 330 420 380 Z M500 380 C560 300 620 330 580 380 Z" fill="${detail}"/>`,
  tee: ({ body, detail }) => `
      <path d="M380 260 L440 240 Q500 290 560 240 L620 260 L760 360 L700 450 L640 410 L640 780 L360 780 L360 410 L300 450 L240 360 Z" fill="${body}"/>
      <path d="M440 240 Q500 290 560 240 L545 236 Q500 268 455 236 Z" fill="${detail}"/>`,
  crewneck: ({ body, detail }) => `
      <path d="M380 260 L440 240 Q500 285 560 240 L620 260 L700 330 L740 700 L670 710 L640 420 L640 780 L360 780 L360 420 L330 710 L260 700 L300 330 Z" fill="${body}"/>
      <rect x="360" y="750" width="280" height="30" fill="${detail}"/>
      <rect x="260" y="680" width="70" height="30" fill="${detail}"/>
      <rect x="670" y="680" width="70" height="30" fill="${detail}"/>`,
  shirt: ({ body, detail }) => `
      <path d="M380 250 L460 230 L500 300 L540 230 L620 250 L760 360 L700 450 L640 410 L640 790 L360 790 L360 410 L300 450 L240 360 Z" fill="${body}"/>
      <path d="M460 230 L500 300 L470 320 L430 250 Z M540 230 L500 300 L530 320 L570 250 Z" fill="${detail}"/>
      <rect x="496" y="300" width="8" height="490" fill="${detail}"/>`,
  jacket: ({ body, detail }) => `
      <path d="M370 240 L450 220 L500 280 L550 220 L630 240 L710 320 L760 720 L680 730 L650 430 L650 800 L350 800 L350 430 L320 730 L240 720 L290 320 Z" fill="${body}"/>
      <path d="M450 220 L500 280 L550 220 L580 236 L520 330 L480 330 L420 236 Z" fill="${detail}"/>
      <rect x="494" y="330" width="12" height="470" fill="${detail}"/>
      <rect x="390" y="560" width="80" height="60" fill="${detail}"/>
      <rect x="530" y="560" width="80" height="60" fill="${detail}"/>`,
  chino: ({ body, detail }) => `
      <path d="M370 230 L630 230 L660 820 L540 820 L500 420 L460 820 L340 820 Z" fill="${body}"/>
      <rect x="370" y="230" width="260" height="44" fill="${detail}"/>`,
  tote: ({ body, detail }) => `
      <path d="M410 400 v-90 a90 90 0 0 1 180 0 v90 h-36 v-90 a54 54 0 0 0 -108 0 v90 Z" fill="${detail}"/>
      <rect x="320" y="400" width="360" height="400" fill="${body}"/>`,
  beanie: ({ body, detail }) => `
      <path d="M320 620 V520 a180 180 0 0 1 360 0 V620 Z" fill="${body}"/>
      <rect x="300" y="600" width="400" height="120" fill="${detail}"/>
      <circle cx="500" cy="320" r="44" fill="${detail}"/>`,
  cap: ({ body, detail }) => `
      <path d="M300 600 V560 a200 200 0 0 1 400 0 V600 Z" fill="${body}"/>
      <path d="M560 600 h220 a20 20 0 0 1 0 40 h-240 Z" fill="${detail}"/>
      <circle cx="500" cy="372" r="16" fill="${detail}"/>`,
};

/** Renders a product drawing to PNG bytes, ready for addProductImage. */
export async function renderProductArt(art: ProductArt): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <rect width="${SIZE}" height="${SIZE}" fill="${art.ground}"/>
    ${drawings[art.kind](art)}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
