/* ---- Code 128B barcode (ISO/IEC 15417) --------------------------------------
   Pattern table: 107 symbols, each 6 runs totalling 11 modules.
   Encodes the asset code so tags can be scanned during physical audit. */
export const C128 = ("212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 " +
  "221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 " +
  "221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 " +
  "212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 " +
  "231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 " +
  "231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 " +
  "314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 " +
  "112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 " +
  "111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 " +
  "214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 " +
  "114131 311141 411131 211412 211214 211232 233111").split(" ");

export const C128_START_B = 104, C128_STOP = 106;

export const C128_START_C = 105;

/* Alternating bar/space runs. Numeric data of even length uses code set C,
   which packs two digits per symbol — roughly half the width. */
export function code128Runs(text: string | number) {
  const str = String(text);
  const useC = /^\d+$/.test(str) && str.length % 2 === 0;
  let values, start;
  if (useC) {
    start = C128_START_C;
    values = str.match(/\d{2}/g).map(Number);
  } else {
    start = C128_START_B;
    values = str.split("").filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126)
      .map((c) => c.charCodeAt(0) - 32);
  }
  let sum = start;
  values.forEach((v, i) => { sum += v * (i + 1); });
  const symbols = [start, ...values, sum % 103, C128_STOP];
  const runs = [];
  symbols.forEach((v) => {
    C128[v].split("").forEach((w, i) => runs.push({ w: Number(w), bar: i % 2 === 0 }));
  });
  runs.push({ w: 2, bar: true }); /* final bar completes the stop pattern */
  return runs;
}
