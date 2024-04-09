/**
 * Crop a string to be suitable for an embed field
 *
 * @param str - The string to crop
 * @returns The cropped string
 */
export function cropFieldContent(str: string): string {
    const CHAR_LIMIT = 1024;

    // The limit is 1,024 characters, so we'll crop it to 1,021 and add an ellipsis
    return str.length > CHAR_LIMIT ? `${str.substring(0, CHAR_LIMIT - 3)}...` : str;
}