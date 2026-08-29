/**
 * DTLA ArtNight — Thursday 3 September 2026.
 *
 * Transcribed from the organisers' printed map. The corridors, their colours
 * and which venue belongs to which are EXACT — that grouping is the editorial
 * content of the poster and the thing this app should be faithful to.
 *
 * Coordinates are not invented. Every lat/lng here was resolved against
 * OpenStreetMap and checked to fall inside Downtown; the rest are null,
 * because the poster is a schematic and a pin dropped on the wrong block is
 * worse than no pin — it looks correct and sends someone to the wrong door.
 * Venues without one still appear everywhere in the app, listed under their
 * corridor with the street they sit on. Fill them in from real addresses and
 * they light up on the map with no code change.
 *
 * Every located venue was then checked against the latitude band its corridor
 * occupies. Dama Gallery matched a business a kilometre and a half south of
 * 4th Street and had its coordinates removed — a geocoder's confident wrong
 * answer is the most dangerous kind, because it looks exactly like a right one.
 */
export type ArtNightVenue = {
  corridor: string;
  name: string;
  slug: string;
  address1: string;
  lat: number | null;
  lng: number | null;
  /** The poster draws a building for this one, not a dot. */
  landmark: boolean;
};

export const ART_NIGHT_CORRIDORS = [
  { slug: "grand-avenue", name: "Grand Avenue", color: "#4A72C4", along: "Grand Ave", sortOrder: 1 },
  { slug: "2nd-street", name: "2nd Street Corridor", color: "#EFC94C", along: "2nd St", sortOrder: 2 },
  { slug: "3rd-street", name: "3rd Street Corridor", color: "#4EC7C0", along: "3rd St", sortOrder: 3 },
  { slug: "4th-street", name: "4th Street Corridor", color: "#9B7BC8", along: "4th St", sortOrder: 4 },
  { slug: "5th-street", name: "5th Street Corridor", color: "#3F7C51", along: "5th St", sortOrder: 5 },
  { slug: "7th-street", name: "7th Street Corridor", color: "#E87FA8", along: "7th St", sortOrder: 6 },
  { slug: "9th-street", name: "9th Street Corridor", color: "#E5883C", along: "9th St", sortOrder: 7 },
  { slug: "fashion-district", name: "Fashion District", color: "#7CC24A", along: null, sortOrder: 8 },
] as const;

export const ART_NIGHT_VENUES: ArtNightVenue[] = [
  { corridor: "grand-avenue", name: "The Broad", slug: "the-broad", address1: "221 South Grand Avenue", lat: 34.0544584, lng: -118.2505943, landmark: true },
  { corridor: "grand-avenue", name: "MOCA", slug: "moca", address1: "250 South Grand Avenue", lat: 34.0532882, lng: -118.2506228, landmark: true },
  { corridor: "grand-avenue", name: "Grand Performances", slug: "grand-performances", address1: "S Olive St", lat: null, lng: null, landmark: true },
  { corridor: "grand-avenue", name: "Dataland", slug: "dataland", address1: "S Olive St", lat: null, lng: null, landmark: false },
  { corridor: "2nd-street", name: "Redwood Bar & Grill", slug: "redwood-bar-grill", address1: "316 West 2nd Street", lat: 34.0527161, lng: -118.2473947, landmark: false },
  { corridor: "2nd-street", name: "Redbird", slug: "redbird", address1: "114 East 2nd Street", lat: 34.0505683, lng: -118.244045, landmark: false },
  { corridor: "2nd-street", name: "The Makery", slug: "the-makery", address1: "Santee St", lat: null, lng: null, landmark: false },
  { corridor: "2nd-street", name: "LA Center of Photography", slug: "la-center-of-photography", address1: "Maple Ave", lat: null, lng: null, landmark: true },
  { corridor: "2nd-street", name: "Sky Portal X", slug: "sky-portal-x", address1: "S Spring St", lat: null, lng: null, landmark: false },
  { corridor: "3rd-street", name: "Gabba Gallery", slug: "gabba-gallery", address1: "S Spring St", lat: null, lng: null, landmark: false },
  { corridor: "3rd-street", name: "Grand Central Market", slug: "grand-central-market", address1: "317 South Broadway", lat: 34.050822, lng: -118.2489349, landmark: true },
  { corridor: "4th-street", name: "Emerging Gallery", slug: "emerging-gallery", address1: "S Spring St", lat: null, lng: null, landmark: false },
  { corridor: "4th-street", name: "HWH Gallery", slug: "hwh-gallery", address1: "S Main St", lat: null, lng: null, landmark: false },
  { corridor: "4th-street", name: "KISO", slug: "kiso", address1: "S Main St", lat: null, lng: null, landmark: false },
  { corridor: "4th-street", name: "The Braly", slug: "the-braly", address1: "S Spring St", lat: null, lng: null, landmark: false },
  { corridor: "4th-street", name: "Dama Gallery", slug: "dama-gallery", address1: "612 East 11th Street", lat: null, lng: null, landmark: false },
  { corridor: "4th-street", name: "Art/Space 114", slug: "art-space-114", address1: "S Main St", lat: null, lng: null, landmark: false },
  { corridor: "4th-street", name: "Shit Art Club", slug: "shit-art-club", address1: "Santee St", lat: null, lng: null, landmark: false },
  { corridor: "4th-street", name: "Gorilla Grip Gallery", slug: "gorilla-grip-gallery", address1: "S Los Angeles St", lat: null, lng: null, landmark: false },
  { corridor: "4th-street", name: "LA Center for Digital Art", slug: "la-center-for-digital-art", address1: "S Main St", lat: null, lng: null, landmark: false },
  { corridor: "4th-street", name: "The Regent", slug: "the-regent", address1: "448 South Main Street", lat: 34.0469856, lng: -118.2478111, landmark: true },
  { corridor: "5th-street", name: "The Biltmore LA", slug: "the-biltmore-la", address1: "506 South Grand Avenue", lat: 34.0493043, lng: -118.2535177, landmark: true },
  { corridor: "5th-street", name: "Perch", slug: "perch", address1: "S Hill St", lat: 34.0489443, lng: -118.2513974, landmark: false },
  { corridor: "5th-street", name: "Mrs. Fish", slug: "mrs-fish", address1: "S Hill St", lat: 34.048898, lng: -118.2514631, landmark: false },
  { corridor: "5th-street", name: "The Last Bookstore", slug: "the-last-bookstore", address1: "453 South Spring Street", lat: 34.0476682, lng: -118.2497228, landmark: true },
  { corridor: "5th-street", name: "Arts Tower Coffee", slug: "arts-tower-coffee", address1: "S Spring St", lat: null, lng: null, landmark: false },
  { corridor: "5th-street", name: "Pulse Gallery", slug: "pulse-gallery", address1: "S Spring St", lat: null, lng: null, landmark: false },
  { corridor: "5th-street", name: "Little Easy Gallery", slug: "little-easy-gallery", address1: "S Broadway", lat: null, lng: null, landmark: false },
  { corridor: "5th-street", name: "Earley Grey", slug: "earley-grey", address1: "S Spring St", lat: null, lng: null, landmark: false },
  { corridor: "5th-street", name: "pskaufman", slug: "pskaufman", address1: "S Hill St", lat: null, lng: null, landmark: false },
  { corridor: "7th-street", name: "Clifton's After Party", slug: "clifton-s-after-party", address1: "S Broadway", lat: null, lng: null, landmark: false },
  { corridor: "7th-street", name: "Spring Street Arcade", slug: "spring-street-arcade", address1: "S Spring St", lat: null, lng: null, landmark: false },
  { corridor: "7th-street", name: "Of The Cloth LA", slug: "of-the-cloth-la", address1: "S Spring St", lat: null, lng: null, landmark: false },
  { corridor: "7th-street", name: "Field of Dreams Gallery", slug: "field-of-dreams-gallery", address1: "S Los Angeles St", lat: null, lng: null, landmark: false },
  { corridor: "7th-street", name: "Rizo Corp Gallery", slug: "rizo-corp-gallery", address1: "S Spring St", lat: null, lng: null, landmark: false },
  { corridor: "7th-street", name: "Gloria Delson Contemporary Arts", slug: "gloria-delson-contemporary-arts", address1: "S Spring St", lat: null, lng: null, landmark: false },
  { corridor: "7th-street", name: "Lucky Cat Labs", slug: "lucky-cat-labs", address1: "S Los Angeles St", lat: null, lng: null, landmark: false },
  { corridor: "7th-street", name: "Deep House Design Store", slug: "deep-house-design-store", address1: "S Spring St", lat: null, lng: null, landmark: false },
  { corridor: "7th-street", name: "The Hive Gallery", slug: "the-hive-gallery", address1: "S Spring St", lat: 34.0440373, lng: -118.253128, landmark: false },
  { corridor: "9th-street", name: "Eastern Gallery", slug: "eastern-gallery", address1: "849 South Broadway", lat: 34.0427446, lng: -118.2562094, landmark: true },
  { corridor: "9th-street", name: "il Caff\u00e8", slug: "il-caffe", address1: "855 South Broadway", lat: 34.0425422, lng: -118.2561046, landmark: false },
  { corridor: "9th-street", name: "Monochrome Gallery", slug: "monochrome-gallery", address1: "S Spring St", lat: null, lng: null, landmark: false },
  { corridor: "9th-street", name: "Pizzeria Republica", slug: "pizzeria-republica", address1: "S Main St", lat: null, lng: null, landmark: false },
  { corridor: "fashion-district", name: "Bendix Building", slug: "bendix-building", address1: "Maple Ave", lat: null, lng: null, landmark: true },
  { corridor: "fashion-district", name: "Kelly O'Brien Atelier", slug: "kelly-o-brien-atelier", address1: "S Main St", lat: null, lng: null, landmark: false },
  { corridor: "fashion-district", name: "CRE8", slug: "cre8", address1: "S Los Angeles St", lat: null, lng: null, landmark: true },
  { corridor: "fashion-district", name: "Zenith Tattoo", slug: "zenith-tattoo", address1: "S Los Angeles St", lat: null, lng: null, landmark: false },
  { corridor: "fashion-district", name: "John Doe", slug: "john-doe", address1: "S Los Angeles St", lat: null, lng: null, landmark: false },
  { corridor: "fashion-district", name: "Upstairs Comedy Club", slug: "upstairs-comedy-club", address1: "S Los Angeles St", lat: null, lng: null, landmark: false },
  { corridor: "fashion-district", name: "Superchief Gallery", slug: "superchief-gallery", address1: "S Main St", lat: null, lng: null, landmark: true },
];

/**
 * The streets each corridor runs along, as real geometry.
 *
 * Fetched from OpenStreetMap and clipped to the poster's extent, then stitched
 * into continuous runs and simplified — DTLA blocks are straight, so most
 * points carried no shape. This is what lets the app draw the poster's coloured
 * routes over an actual map rather than a diagram of one.
 *
 * Each line is clipped to the span the poster draws: the true geometric
 * intersection of the corridor's street with the two cross-streets its coloured
 * line runs between, interpolated so a line ends exactly at the crossing rather
 * than at whichever survey point fell nearby.
 *
 * Two run short of the poster. 2nd Street is drawn to Maple Avenue and 4th to
 * Santee, but neither street reaches those in the map data, so both stop at Los
 * Angeles Street. Stopping early is the honest failure: the alternative is
 * extending a line through blocks it may not actually cover.
 */
export const ART_NIGHT_PATHS: Record<string, number[][][]> = {
  "grand-avenue": [
    [[34.050196, -118.253938], [34.050196, -118.253938], [34.050098, -118.254028], [34.04994, -118.254174], [34.049858, -118.254249], [34.049525, -118.254555], [34.049458, -118.254615], [34.04937, -118.254697], [34.04934, -118.254725], [34.049298, -118.254763], [34.049086, -118.254959], [34.048823, -118.255203], [34.048734, -118.255286], [34.048668, -118.255347], [34.048052, -118.255923], [34.047973, -118.255998], [34.047892, -118.256073], [34.047762, -118.256194], [34.047385, -118.256548], [34.047358, -118.256574], [34.047306, -118.256625], [34.047249, -118.256676], [34.047223, -118.256698], [34.046941, -118.256957], [34.046899, -118.256995], [34.046718, -118.257161], [34.046545, -118.257321], [34.046428, -118.257429], [34.046347, -118.257504], [34.046255, -118.257589], [34.046119, -118.257715], [34.045928, -118.257889], [34.045854, -118.257957], [34.045789, -118.258017], [34.045538, -118.258256], [34.045219, -118.258555], [34.044822, -118.258926], [34.044686, -118.259053], [34.044326, -118.259392], [34.043615, -118.260052], [34.043103, -118.260529], [34.043012, -118.260614], [34.042919, -118.260701], [34.042602, -118.260996], [34.04258, -118.261015], [34.042422, -118.261161], [34.041719, -118.261818], [34.041609, -118.261921], [34.041571, -118.261955], [34.041551, -118.261974], [34.041472, -118.262048], [34.040358, -118.263085], [34.054473, -118.249881]],
  ],
  "2nd-street": [
    [[34.052403, -118.246688], [34.052403, -118.246688], [34.052323, -118.246573], [34.052101, -118.246237], [34.0518, -118.245775], [34.051778, -118.245742], [34.051705, -118.245623], [34.051671, -118.245568], [34.051649, -118.245535], [34.051622, -118.245492], [34.051428, -118.245191], [34.051362, -118.245095], [34.05133, -118.245044], [34.051094, -118.244676], [34.051071, -118.244639], [34.05104, -118.244594], [34.051005, -118.244533], [34.050945, -118.244433], [34.050922, -118.244395], [34.050355, -118.243487], [34.050276, -118.243355]],
  ],
  "3rd-street": [
    [[34.050275, -118.246985], [34.050275, -118.246985], [34.05029, -118.247003], [34.050333, -118.247055], [34.050508, -118.247321], [34.050647, -118.247535], [34.050699, -118.247615], [34.050911, -118.247946], [34.050968, -118.248029], [34.051032, -118.248124], [34.05132, -118.248567], [34.051376, -118.248653], [34.051609, -118.249015], [34.051672, -118.249108]],
  ],
  "4th-street": [
    [[34.047254, -118.246202], [34.047254, -118.246202], [34.047341, -118.246301], [34.047368, -118.246331], [34.047724, -118.246731], [34.048055, -118.247124], [34.048128, -118.247212], [34.04816, -118.247258], [34.048193, -118.247307], [34.048475, -118.24775], [34.048573, -118.247902], [34.048774, -118.248213], [34.048807, -118.248263], [34.048845, -118.248322]],
  ],
  "5th-street": [
    [[34.047409, -118.249671], [34.047409, -118.249671], [34.047455, -118.249742], [34.047737, -118.250172], [34.048025, -118.250632], [34.048079, -118.250716], [34.04814, -118.250815], [34.048441, -118.251283], [34.04867, -118.251651], [34.048704, -118.251706], [34.048798, -118.251849], [34.048846, -118.251919], [34.048963, -118.252105], [34.049476, -118.252866], [34.04955, -118.252965], [34.049866, -118.253436], [34.049988, -118.253617], [34.050131, -118.253827], [34.050196, -118.253938]],
  ],
  "7th-street": [
    [[34.043267, -118.25044], [34.043267, -118.25044], [34.043333, -118.250538], [34.043576, -118.25088], [34.043641, -118.250972], [34.043868, -118.25129], [34.043932, -118.251381], [34.04397, -118.251441], [34.043989, -118.251471], [34.044235, -118.251871], [34.044529, -118.25233], [34.044497, -118.252284], [34.044469, -118.252245], [34.044529, -118.25233], [34.044585, -118.252413], [34.044915, -118.25292], [34.045149, -118.253287], [34.045215, -118.253391]],
  ],
  "9th-street": [
    [[34.042333, -118.256081], [34.042277, -118.255996], [34.042038, -118.255633], [34.041985, -118.255553], [34.041697, -118.255108], [34.04168, -118.255081], [34.041606, -118.255002]],
  ],
  "fashion-district": [
    [[34.038431, -118.257128], [34.038431, -118.257128], [34.038363, -118.257183], [34.03699, -118.2583], [34.036926, -118.258352], [34.036857, -118.258409], [34.036416, -118.258776], [34.036306, -118.258867], [34.036254, -118.258912], [34.035787, -118.259312], [34.035728, -118.259362], [34.035672, -118.259407], [34.03478, -118.260123], [34.034722, -118.26017], [34.034675, -118.260208], [34.033757, -118.260948], [34.033704, -118.26099]],
  ],
};
