import { writable } from "svelte/store";
import { Mutex } from "./Utils";

export const sessions = writable<Session[]>([]);
export const activeSession = writable<Session>();
export const mutex = new Mutex();
