const BASE_WORDS = [
  'ash', 'echo', 'midnight', 'forest', 'river', 'silent', 'lantern', 'autumn', 'shadow', 'ember',
  'meadow', 'winter', 'solitude', 'harbor', 'orbit', 'drift', 'horizon', 'starlight', 'frost', 'whisper',
  'stone', 'tide', 'pine', 'dust', 'canyon', 'moss', 'willow', 'cedar', 'aurora', 'dusk',
  'dawn', 'vale', 'wind', 'raven', 'comet', 'abyss', 'veil', 'monolith', 'oasis', 'sanctuary',
  'compass', 'summit', 'archive', 'glacier', 'lagoon', 'zenith', 'beacon', 'breeze', 'solstice', 'twilight',
  'aspen', 'obsidian', 'tundra', 'serenade', 'estuary', 'cliff', 'timber', 'cypress', 'quarry', 'ridge',
  'cavern', 'fjord', 'plateau', 'grove', 'hollow', 'heath', 'marsh', 'thistle', 'fern', 'lichen',
  'flint', 'marble', 'basalt', 'quartz', 'cobalt', 'onyx', 'amber', 'copper', 'slate', 'fossil',
  'spire', 'pinnacle', 'valley', 'coast', 'reef', 'shoal', 'headland', 'isle', 'atoll', 'strait',
  'channel', 'sound', 'haven', 'shelter', 'solace', 'repose', 'quiet', 'hush', 'stillness', 'pause',
  'breath', 'pulse', 'lunar', 'solar', 'astral', 'cosmic', 'stellar', 'nebula', 'equinox', 'meridian',
  'prism', 'monsoon', 'crest', 'stream', 'clearing', 'pines', 'meadows',
] as const;

const WORD_PREFIXES = [
  'amber', 'ancient', 'apple', 'apricot', 'arctic', 'ashen', 'autumn', 'azure',
  'beacon', 'birch', 'black', 'blue', 'brave', 'bright', 'bronze', 'calm',
  'candle', 'cedar', 'cinder', 'clear', 'cloud', 'coastal', 'copper', 'coral',
  'crystal', 'dawn', 'deep', 'desert', 'distant', 'drift', 'dusky', 'evening',
  'evergreen', 'faint', 'fern', 'flint', 'frost', 'golden', 'granite', 'green',
  'hidden', 'hollow', 'indigo', 'iron', 'ivory', 'juniper', 'late', 'lavender',
  'lunar', 'marble', 'meadow', 'misty', 'moon', 'mossy', 'northern', 'oak',
  'olive', 'opal', 'orange', 'quiet', 'raven', 'red', 'river', 'rose',
] as const;

const WORD_SUFFIXES = [
  'acorn', 'apple', 'arrow', 'aspen', 'beacon', 'birch', 'bloom', 'brook',
  'canyon', 'cedar', 'cliff', 'cloud', 'comet', 'cove', 'crest', 'dawn',
  'drift', 'dune', 'ember', 'fern', 'fjord', 'flame', 'flower', 'forest',
  'garden', 'grove', 'harbor', 'heath', 'hill', 'island', 'lake', 'lantern',
] as const;

const generatedWords = WORD_PREFIXES.flatMap((prefix) =>
  WORD_SUFFIXES.map((suffix) => `${prefix}${suffix}`),
);

export const WORDLIST: string[] = [...BASE_WORDS, ...generatedWords];

const invalidWord = WORDLIST.find((word) => !/^[a-z]+$/.test(word));
const duplicateCount = WORDLIST.length - new Set(WORDLIST).size;

if (WORDLIST.length < 2048 || invalidWord || duplicateCount > 0) {
  throw new Error(
    `Invalid V2 WORDLIST: ${WORDLIST.length} entries, invalid=${invalidWord ?? 'none'}, duplicates=${duplicateCount}`,
  );
}
