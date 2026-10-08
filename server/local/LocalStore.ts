import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.env.LOCAL_DATA_DIR?.trim() || join(process.cwd(), ".local-data");

export async function readCollection<T>(name: string): Promise<T[]> {
  try { return JSON.parse(await readFile(join(root, `${name}.json`), "utf8")) as T[]; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}

export async function writeCollection<T>(name: string, records: T[]): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(join(root, `${name}.json`), JSON.stringify(records, null, 2), "utf8");
}
