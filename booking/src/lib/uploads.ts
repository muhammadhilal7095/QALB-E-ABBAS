import path from "node:path";
/** Private upload folder (outside /public — files are only served through an authorised route). */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
