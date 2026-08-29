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
  { corridor: "grand-avenue", name: "The Broad", slug: "the-broad", address1: "221 South Grand Avenue", lat: 34.0544584, lng: -118.2505943 },
  { corridor: "grand-avenue", name: "MOCA", slug: "moca", address1: "250 South Grand Avenue", lat: 34.0532882, lng: -118.2506228 },
  { corridor: "grand-avenue", name: "Grand Performances", slug: "grand-performances", address1: "S Olive St", lat: null, lng: null },
  { corridor: "grand-avenue", name: "Dataland", slug: "dataland", address1: "S Olive St", lat: null, lng: null },
  { corridor: "2nd-street", name: "Redwood Bar & Grill", slug: "redwood-bar-grill", address1: "316 West 2nd Street", lat: 34.0527161, lng: -118.2473947 },
  { corridor: "2nd-street", name: "Redbird", slug: "redbird", address1: "114 East 2nd Street", lat: 34.0505683, lng: -118.244045 },
  { corridor: "2nd-street", name: "The Makery", slug: "the-makery", address1: "Santee St", lat: null, lng: null },
  { corridor: "2nd-street", name: "LA Center of Photography", slug: "la-center-of-photography", address1: "Maple Ave", lat: null, lng: null },
  { corridor: "2nd-street", name: "Sky Portal X", slug: "sky-portal-x", address1: "S Spring St", lat: null, lng: null },
  { corridor: "3rd-street", name: "Gabba Gallery", slug: "gabba-gallery", address1: "S Spring St", lat: null, lng: null },
  { corridor: "3rd-street", name: "Grand Central Market", slug: "grand-central-market", address1: "317 South Broadway", lat: 34.050822, lng: -118.2489349 },
  { corridor: "4th-street", name: "Emerging Gallery", slug: "emerging-gallery", address1: "S Spring St", lat: null, lng: null },
  { corridor: "4th-street", name: "HWH Gallery", slug: "hwh-gallery", address1: "S Main St", lat: null, lng: null },
  { corridor: "4th-street", name: "KISO", slug: "kiso", address1: "S Main St", lat: null, lng: null },
  { corridor: "4th-street", name: "The Braly", slug: "the-braly", address1: "S Spring St", lat: null, lng: null },
  { corridor: "4th-street", name: "Dama Gallery", slug: "dama-gallery", address1: "612 East 11th Street", lat: null, lng: null },
  { corridor: "4th-street", name: "Art/Space 114", slug: "art-space-114", address1: "S Main St", lat: null, lng: null },
  { corridor: "4th-street", name: "Shit Art Club", slug: "shit-art-club", address1: "Santee St", lat: null, lng: null },
  { corridor: "4th-street", name: "Gorilla Grip Gallery", slug: "gorilla-grip-gallery", address1: "S Los Angeles St", lat: null, lng: null },
  { corridor: "4th-street", name: "LA Center for Digital Art", slug: "la-center-for-digital-art", address1: "S Main St", lat: null, lng: null },
  { corridor: "4th-street", name: "The Regent", slug: "the-regent", address1: "448 South Main Street", lat: 34.0469856, lng: -118.2478111 },
  { corridor: "5th-street", name: "The Biltmore LA", slug: "the-biltmore-la", address1: "506 South Grand Avenue", lat: 34.0493043, lng: -118.2535177 },
  { corridor: "5th-street", name: "Perch", slug: "perch", address1: "S Hill St", lat: 34.0489443, lng: -118.2513974 },
  { corridor: "5th-street", name: "Mrs. Fish", slug: "mrs-fish", address1: "S Hill St", lat: 34.048898, lng: -118.2514631 },
  { corridor: "5th-street", name: "The Last Bookstore", slug: "the-last-bookstore", address1: "453 South Spring Street", lat: 34.0476682, lng: -118.2497228 },
  { corridor: "5th-street", name: "Arts Tower Coffee", slug: "arts-tower-coffee", address1: "S Spring St", lat: null, lng: null },
  { corridor: "5th-street", name: "Pulse Gallery", slug: "pulse-gallery", address1: "S Spring St", lat: null, lng: null },
  { corridor: "5th-street", name: "Little Easy Gallery", slug: "little-easy-gallery", address1: "S Broadway", lat: null, lng: null },
  { corridor: "5th-street", name: "Earley Grey", slug: "earley-grey", address1: "S Spring St", lat: null, lng: null },
  { corridor: "5th-street", name: "pskaufman", slug: "pskaufman", address1: "S Hill St", lat: null, lng: null },
  { corridor: "7th-street", name: "Clifton's After Party", slug: "clifton-s-after-party", address1: "S Broadway", lat: null, lng: null },
  { corridor: "7th-street", name: "Spring Street Arcade", slug: "spring-street-arcade", address1: "S Spring St", lat: null, lng: null },
  { corridor: "7th-street", name: "Of The Cloth LA", slug: "of-the-cloth-la", address1: "S Spring St", lat: null, lng: null },
  { corridor: "7th-street", name: "Field of Dreams Gallery", slug: "field-of-dreams-gallery", address1: "S Los Angeles St", lat: null, lng: null },
  { corridor: "7th-street", name: "Rizo Corp Gallery", slug: "rizo-corp-gallery", address1: "S Spring St", lat: null, lng: null },
  { corridor: "7th-street", name: "Gloria Delson Contemporary Arts", slug: "gloria-delson-contemporary-arts", address1: "S Spring St", lat: null, lng: null },
  { corridor: "7th-street", name: "Lucky Cat Labs", slug: "lucky-cat-labs", address1: "S Los Angeles St", lat: null, lng: null },
  { corridor: "7th-street", name: "Deep House Design Store", slug: "deep-house-design-store", address1: "S Spring St", lat: null, lng: null },
  { corridor: "7th-street", name: "The Hive Gallery", slug: "the-hive-gallery", address1: "S Spring St", lat: 34.0440373, lng: -118.253128 },
  { corridor: "9th-street", name: "Eastern Gallery", slug: "eastern-gallery", address1: "849 South Broadway", lat: 34.0427446, lng: -118.2562094 },
  { corridor: "9th-street", name: "il Caff\u00e8", slug: "il-caffe", address1: "855 South Broadway", lat: 34.0425422, lng: -118.2561046 },
  { corridor: "9th-street", name: "Monochrome Gallery", slug: "monochrome-gallery", address1: "S Spring St", lat: null, lng: null },
  { corridor: "9th-street", name: "Pizzeria Republica", slug: "pizzeria-republica", address1: "S Main St", lat: null, lng: null },
  { corridor: "fashion-district", name: "Bendix Building", slug: "bendix-building", address1: "Maple Ave", lat: null, lng: null },
  { corridor: "fashion-district", name: "Kelly O'Brien Atelier", slug: "kelly-o-brien-atelier", address1: "S Main St", lat: null, lng: null },
  { corridor: "fashion-district", name: "CRE8", slug: "cre8", address1: "S Los Angeles St", lat: null, lng: null },
  { corridor: "fashion-district", name: "Zenith Tattoo", slug: "zenith-tattoo", address1: "S Los Angeles St", lat: null, lng: null },
  { corridor: "fashion-district", name: "John Doe", slug: "john-doe", address1: "S Los Angeles St", lat: null, lng: null },
  { corridor: "fashion-district", name: "Upstairs Comedy Club", slug: "upstairs-comedy-club", address1: "S Los Angeles St", lat: null, lng: null },
  { corridor: "fashion-district", name: "Superchief Gallery", slug: "superchief-gallery", address1: "S Main St", lat: null, lng: null },
];
