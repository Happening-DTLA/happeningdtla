# The map crash: react-native-maps under Fabric

Three hard crashes in this app came from one mechanism. Each looked different,
each was diagnosed from a single number in the crash report, and the fixes are
cumulative — remove any one of them and the crash comes back. This is the whole
picture so nobody has to reconstruct it a fourth time.

## What it looks like

The app exits to the home screen. **No red box, no JS error, no warning in the
Metro log.** Expo Go simply disappears mid-interaction, usually on the map.

That absence is itself the first clue: a JS exception in React Native produces
an error screen. Going straight to the springboard means a native exception or
an out-of-memory kill.

The report (Settings → Privacy & Security → Analytics & Improvements →
Analytics Data → `Expo Go-<date>.ips`) always contains this shape:

```
exceptionReason:
  "*** -[__NSArrayM insertObject:atIndex:]: index N beyond bounds [0 .. M]"
  NSRangeException

lastExceptionBacktrace:
  -[__NSArrayM insertObject:atIndex:]
  <Expo Go>
  facebook::react::TelemetryController::pullTransaction
```

`pullTransaction` is Fabric applying a mounting transaction. Something told a
native view to insert a child at an index its array does not have.

## Why it happens

`react-native-maps@1.20.1` — the version **Expo Go SDK 54 pins, and which
cannot be changed inside Expo Go** — ships no Fabric components. Check for
yourself:

```bash
npm view react-native-maps@1.20.1 codegenConfig   # undefined
npm view react-native-maps@1.29.0 codegenConfig   # RNMapsMapView, RNMapsMarker, …
```

With `newArchEnabled: true`, every `MapView`, `Marker` and `Polyline` is
therefore driven by `RCTLegacyViewManagerInteropComponentView`, in
`node_modules/react-native/React/Fabric/Mounting/ComponentViews/LegacyViewManagerInterop/`.

Two things in that file cause everything below.

**Mounting takes one of two paths.**

```objc
- (void)mountChildComponentView:(UIView<RCTComponentViewProtocol> *)child index:(NSInteger)index
{
  if (_adapter && index == _adapter.paperView.reactSubviews.count) {
    [_adapter.paperView insertReactSubview:target atIndex:index];   // direct
  } else {
    [_viewsToBeMounted addObject:@{ … index …, … child … }];        // queued
  }
}
```

A child is inserted immediately **only** when the adapter already exists *and*
the index is an append. Everything else is queued with the index it wanted at
the time.

**The queue is replayed later, insertions before removals.**

```objc
- (void)finalizeUpdates:(RNComponentViewUpdateMask)updateMask
{
  if (!_adapter) { _adapter = [[…alloc] init…]; self.contentView = _adapter.paperView; }

  for (NSDictionary *m in _viewsToBeMounted)  [_adapter.paperView insertReactSubview:… atIndex:…];
  for (UIView *v in _viewsToBeUnmounted)      [_adapter.paperView removeReactSubview:v];
}
```

Queued indices are replayed against whatever the array looks like *now*, which
is not what it looked like when they were queued.

## The three failures, and what each number meant

Read `exceptionReason.arguments`: `[selector, requestedIndex, upperBound]`. The
upper bound is the array's count, and it identifies which view is in trouble.

### 1. `index 3 beyond bounds [0 .. 0]` — the child list changed size

An empty array. Children were being removed and added in the same transaction:
filtering the map from 56 pins down to 5. The queued insertions replayed before
the removals were processed, against a list that no longer had those slots.

**Fix: the number of MapView children never changes.** Every pin is always
rendered; filtering is expressed with the `opacity` prop instead. Zero alpha
also stops UIKit hit-testing the view, so a hidden pin is inert for free and
the tap falls through to the map.

### 2. `index 28 beyond bounds [0 .. 22]` — everything queued on first mount

Twenty-two is not a stable count; it is the map caught partway through mounting
its 64 children. On a first mount `_adapter` is nil, so *every* child takes the
queued path, and replaying that many nested interop views does not reliably
grow the array.

**Fix: the map mounts empty and takes its children on `onMapReady`.** By then
the adapter exists, so each insert is an append and takes the direct path. A
350ms timer backs it up — a map with no pins would be worse than the crash.

### 3. `index 11 beyond bounds [0 .. 9]` — nested interop children

Nine is eight polylines plus one marker. Every polyline landed and the first
marker landed; the second did not, and every index after it was off by one.

The difference between those two kinds of child is the answer. A `Polyline` has
no React children. A `Marker`'s child is our own view — a legacy interop view
nested inside another one — and `AIRMap` is handed
`((RCTLegacyViewManagerInteropComponentView *)child).contentView`, which is not
set until that child's own `finalizeUpdates` runs. Handed nothing, `AIRMap`
does not grow its array and reports nothing.

*(The nil-`contentView` step is inferred from the evidence — polylines mounted
cleanly and markers did not — rather than read from a nil check in the source.
The fix is empirical and it holds; treat the mechanism as the best available
explanation rather than a proven one.)*

**Fix: markers mount one per frame.** A frame is enough for the child to
finish. Appending is also the safe direction, and the count still only grows.

## The rules

All three live in `apps/mobile/src/EventMap.tsx`. Undoing any one brings the
crash back.

1. **The number of MapView children never changes.** Filter with `opacity`,
   never by removing markers from the array.
2. **Children are never mounted with the map.** Withhold until `onMapReady`.
3. **Never mount more than one Marker per frame.** Polylines are exempt: they
   have no React children.

Two more, learned alongside:

- **`tracksViewChanges` does nothing here.** It is exported only by the
  Google-provider marker manager; `AIRMapMarkerManager.m` never lists it. The
  state and timer behind it cost two extra renders per marker for nothing.
- **Keep `zIndex` constant per marker.** Setting it writes `layer.zPosition`,
  which fires a KVO observer the library installs on that key path and which
  writes it straight back. Deriving it from something that changes while the
  map moves sends every marker through that re-entrant path continuously.

## The same constraint, without a crash

Annotation views also dislike being **resized** in place, and that one shows up
as a visual fault rather than a crash. Selecting a pin used to turn a 14pt dot
into a ~150pt labelled pill; the native view kept its old frame, so the tapped
pin was drawn as a bare dot with its label gone — the opposite of what a tap
should do. Giving the selected pin a guaranteed label made it worse, because
the new label evicted whichever neighbours it overlapped and those collapsed to
dots too, which reads as markers disappearing at random.

So: **selection is a paint change, never a layout change.** A selected dot
stays a dot and gains a ring; a selected pill stays a pill and fills with its
colour. React Native draws borders inside the box, so a ring costs no size.
Label placement no longer knows what is selected at all.

## The actual fix

`react-native-maps@1.29+` has real Fabric components and no interop layer, so
none of the above applies. It needs a **development build** — Expo Go's binary
is fixed and pins 1.20.1. Do this as soon as the Apple Developer account is
active, then delete the three workarounds and this document.

## Diagnosing the next one

1. Get the `.ips` from the phone, not the Mac. macOS System Settings has no
   Analytics Data row; iOS Settings does.
2. Read `exceptionReason.arguments`.
3. Compare the upper bound against the known child counts — currently 8
   polylines and 56 markers. The bound says how far the mount got, which says
   which rule broke.
4. Resist diagnosing into the code first. Two earlier rounds on this blamed
   memory pressure and then the `zIndex` KVO path; both were wrong, and the
   crash report settled it each time in one read.
