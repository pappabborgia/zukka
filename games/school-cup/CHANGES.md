# School Cup: what changed for Zukka

Source: `pappabborgia/school-cup`, `index.html` (commit 19c3bf9). Graphics, music and rules are unchanged, except:

- **Fonts** Fredoka and Lilita One are embedded in the file (SIL Open Font License 1.1) instead of loaded from Google Fonts.
- **Teams**: every club is made up (striped, hooped, halved or sashed shields with initials). The real clubs,
  their crests and Barcelona, Real Madrid and Roma are gone; the three "giants" are now Galaxy Giants,
  Royal Thunder and Golden Dragons. National teams keep only their name and flag emoji.
- **Tournaments**: Pirate Ship Cup, Lighthouse Cup, Dragon Cup, Rocket Cup, World Cup.
- **Players**: no names. The child picks Year 2 or Year 3. Our team is Zukka FC. A story character called Leo is now Theo.
- **Removed**: microphone exercises, Homework from a photo, cloud save, Claude's voice.
  Phonics stays, without the microphone: "read it aloud" is an honest self-check with a grown-up,
  "listen and choose" and "listen and type" use the device voice.
- **Voice**: only English voices with `localService === true` (they run on the device). With none, no voice.
- **No storage**: nothing is saved in the browser. Cups, match points and trophies last while the game is open.
- **All rounds open**: tap any round of a cup to play it. Winning all six rounds lifts the trophy.
- **Points** inside the game are only the match score for this session. Zukka points are shown by the page around it.
- **Events**: `game_started` at kick-off, `answer` for each answer of the home team (in the 2-player friendly too),
  `game_completed` with the home team's correct answers and total at the final whistle.
