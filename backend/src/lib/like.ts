/* LIKE treats % and _ as wildcards; search text is matched literally */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

/** "%text%" for a case-insensitive contains search */
export const containsPattern = (s: string) => `%${escapeLike(s)}%`;
