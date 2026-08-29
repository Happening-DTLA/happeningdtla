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
 * [lat, lng] pairs, one array per continuous run. The Fashion District has no
 * entry: it is a district rather than a street, and inventing a line through it
 * would be drawing a route nobody walks.
 */
export const ART_NIGHT_PATHS: Record<string, number[][][]> = {
  "3rd-street": [
    [[34.045541, -118.238067], [34.046033, -118.239375], [34.046178, -118.239733], [34.046342, -118.240221], [34.04737, -118.242651], [34.0479, -118.243707], [34.049428, -118.245773], [34.049553, -118.245881], [34.050333, -118.247055], [34.051837, -118.249364], [34.053238, -118.25153], [34.053964, -118.252649], [34.054705, -118.253843], [34.055132, -118.254505], [34.055566, -118.255164], [34.055856, -118.255576], [34.055987, -118.255778], [34.056296, -118.256286], [34.056542, -118.25665], [34.056577, -118.256897], [34.056764, -118.257811], [34.057096, -118.25862], [34.05711, -118.258744]],
    [[34.055036, -118.254612], [34.05469, -118.254093], [34.054435, -118.253704], [34.054407, -118.253672], [34.054321, -118.253651], [34.054231, -118.253666]],
    [[34.053694, -118.252319], [34.053623, -118.252201], [34.052968, -118.251214]],
  ],
  "4th-street": [
    [[34.051747, -118.252827], [34.051915, -118.253327], [34.052131, -118.25366], [34.052433, -118.254177], [34.052605, -118.254529], [34.053117, -118.255299], [34.054262, -118.256855], [34.054467, -118.256993], [34.055147, -118.257403], [34.05535, -118.25751], [34.055572, -118.257597], [34.055936, -118.257715], [34.055262, -118.257302], [34.054401, -118.256768], [34.054242, -118.25664], [34.054099, -118.256478], [34.053905, -118.256191], [34.050986, -118.251637], [34.050852, -118.25141], [34.04989, -118.249937], [34.049584, -118.249468], [34.049471, -118.249289], [34.047724, -118.246731], [34.047254, -118.246202], [34.047179, -118.24609], [34.046973, -118.245725], [34.046406, -118.244617], [34.046253, -118.244172], [34.045772, -118.242915], [34.044379, -118.240657], [34.043968, -118.24], [34.043626, -118.239374], [34.043303, -118.238119]],
    [[34.05711, -118.258744], [34.057033, -118.258659], [34.056891, -118.258346], [34.056718, -118.258161], [34.055936, -118.257715]],
    [[34.055843, -118.258399], [34.056085, -118.258965], [34.057423, -118.262152]],
    [[34.052408, -118.253565], [34.053358, -118.255068], [34.053793, -118.255733]],
  ],
  "5th-street": [
    [[34.04166, -118.238214], [34.041725, -118.23983], [34.041793, -118.240012], [34.042079, -118.240492], [34.044784, -118.245597], [34.044947, -118.245926], [34.045152, -118.246231], [34.045402, -118.246615], [34.045851, -118.247287], [34.045986, -118.247474], [34.046122, -118.247677], [34.046364, -118.248066], [34.046846, -118.248803], [34.047737, -118.250172], [34.048441, -118.251283], [34.048963, -118.252105], [34.04955, -118.252965], [34.050131, -118.253827], [34.051018, -118.255196], [34.051505, -118.255961], [34.051592, -118.256081], [34.052537, -118.257616], [34.052694, -118.258004], [34.052757, -118.258333], [34.052821, -118.25889], [34.052898, -118.259413], [34.052946, -118.259525], [34.053231, -118.260065], [34.053373, -118.260393], [34.053519, -118.260888]],
    [[34.053911, -118.259072], [34.054098, -118.259533], [34.054334, -118.260083], [34.054911, -118.26144]],
  ],
  "9th-street": [
    [[34.045812, -118.261464], [34.044341, -118.259172], [34.040658, -118.254023], [34.040369, -118.253693], [34.04029, -118.253643], [34.040103, -118.253444], [34.039996, -118.253304], [34.039239, -118.252443], [34.034695, -118.247478], [34.034415, -118.247127], [34.034373, -118.247068]],
  ],
  "2nd-street": [
    [[34.053099, -118.247784], [34.052479, -118.246811], [34.052266, -118.246477], [34.052101, -118.246237], [34.050355, -118.243487], [34.050194, -118.243232], [34.04963, -118.242306], [34.049391, -118.241898], [34.047848, -118.239525], [34.047198, -118.238526], [34.047159, -118.238107]],
    [[34.05341, -118.248266], [34.053099, -118.247784], [34.053263, -118.247809], [34.053885, -118.24874], [34.053933, -118.248897], [34.05409, -118.249163], [34.054229, -118.249465], [34.054859, -118.250469], [34.055132, -118.25091]],
    [[34.056328, -118.252805], [34.056858, -118.253621], [34.057631, -118.254784]],
  ],
  "grand-avenue": [
    [[34.051481, -118.252713], [34.051597, -118.252506], [34.053092, -118.251105], [34.053774, -118.250465], [34.053941, -118.250319], [34.054135, -118.250216], [34.05408, -118.250326], [34.054018, -118.250416], [34.053934, -118.250507], [34.051686, -118.252602], [34.051481, -118.252713], [34.051136, -118.25303], [34.050884, -118.253277], [34.050674, -118.253463], [34.043615, -118.260052]],
    [[34.055677, -118.248754], [34.055292, -118.249045], [34.055096, -118.249206], [34.05481, -118.2495], [34.054135, -118.250216]],
  ],
  "7th-street": [
    [[34.049581, -118.260475], [34.049029, -118.259327], [34.043194, -118.250343], [34.042256, -118.249015], [34.040771, -118.246861], [34.038672, -118.24392], [34.038183, -118.243204], [34.036346, -118.240604], [34.035769, -118.239787], [34.035481, -118.239383], [34.035211, -118.238979], [34.035085, -118.238769], [34.035013, -118.23862], [34.034954, -118.238302], [34.034927, -118.237926]],
  ],
};
