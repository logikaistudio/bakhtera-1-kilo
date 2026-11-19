export const normalizeBlinkNumberPrefix = (number) =>
    typeof number === 'string' ? number.replace(/(^|-)BLK(?=\d)/g, '$1BFW') : number;
