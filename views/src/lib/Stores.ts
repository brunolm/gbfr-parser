import { writable } from "svelte/store";
import { Mutex } from "./Utils";

export const sessions = writable<Session[]>([]);
export const sessionIdx = writable<number>(0);
export const mutex = new Mutex();
