import { useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { venuePhotoUrl } from "@dtlahappening/core";
import { API_BASE_URL } from "@/api";
import { theme, space, type } from "@/theme";

/**
 * What the place actually looks like.
 *
 * On a crawl the useful question is "which door is it" — a name and a street
 * number are a lot less help at night than a picture of the room. So these are
 * the venue's own photographs rather than an event flyer, and they sit where
 * someone deciding whether to walk another block will see them.
 *
 * Only about a quarter of venues have any, so this renders nothing at all when
 * there are none rather than reserving a grey rectangle. An empty frame reads
 * as broken; an absence reads as a page that never promised a photo.
 *
 * Every URL goes through the web app's image optimiser. The organisers' CDN
 * ignores resize parameters and serves the originals — PNGs of photographs
 * running to three megabytes — which is unusable on cellular in Downtown.
 */
export function VenuePhotos({ photos, name }: { photos: string[]; name: string }) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  if (photos.length === 0) return null;

  const height = Math.round(width * 0.62);
  // Asking for the screen's width in points would come back soft on a 3x
  // display; the optimiser snaps up to its next allowed size anyway.
  const pixels = Math.round(width * 2);

  if (photos.length === 1) {
    return (
      <Image
        source={venuePhotoUrl(API_BASE_URL, photos[0]!, pixels)}
        style={{ width, height, backgroundColor: theme.surface }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={220}
        accessibilityLabel={name}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        // Cover, not contain. These are photographs of rooms rather than
        // flyers, so there is no text in them to preserve and letterboxing
        // would only put bars around a picture of a bar.
      >
        {photos.map((photo, i) => (
          <Image
            key={photo}
            source={venuePhotoUrl(API_BASE_URL, photo, pixels)}
            style={{ width, height, backgroundColor: theme.surface }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={220}
            accessibilityLabel={`${name}, photo ${i + 1} of ${photos.length}`}
            accessibilityIgnoresInvertColors
          />
        ))}
      </ScrollView>

      {/* Ticks rather than dots: the rest of the app is set in hard-edged
          blocks, and a row of soft circles here would be the one place that
          looked like a different product. */}
      <View
        style={{
          position: "absolute",
          bottom: space.md,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          gap: 5,
        }}
        pointerEvents="none"
      >
        {photos.map((photo, i) => (
          <View
            key={photo}
            style={{
              width: i === page ? 18 : 10,
              height: 3,
              backgroundColor: i === page ? theme.accent : "#ffffff",
              opacity: i === page ? 1 : 0.45,
            }}
          />
        ))}
      </View>

      <Text
        style={[
          type.label,
          { color: theme.textMuted, paddingHorizontal: space.lg, paddingTop: space.sm },
        ]}
      >
        {photos.length} photos
      </Text>
    </View>
  );
}
