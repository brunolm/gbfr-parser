import type { Chart } from "chart.js";
import { _ } from "svelte-i18n";
import { get } from "svelte/store";
import { colors, period } from "./Constants";
import Mutex from "./Mutex";
import { activeSession, mutex, sessions } from "./Stores";

export const loadSavedSessions = (): Session[] => {
  const json = localStorage.getItem("sessions");
  if (!json) return [];

  const data: Session[] = JSON.parse(json);
  data.forEach(e => {
    if (!(e as any).last_at) return;
    e.start_damage_at = e.start_at;
    e.last_damage_at = (e as any).last_at;
  });

  return data;
};

export const saveSessions = () => {
  let clones: Session[] = JSON.parse(JSON.stringify(get(sessions)));
  clones = clones.filter(session => {
    delete session.mutex;
    session.done = true;
    return session.total_dmg > 0;
  });

  localStorage.setItem("sessions", JSON.stringify(clones));
};

export const createSession = (time: number) => {
  const $sessions = get(sessions);
  if ($sessions.length) {
    const session = $sessions[$sessions.length - 1];
    if (!session.done) {
      session.done = true;
      pruneEvents(session);
      calculateDps(session);
    }
  }

  const session: Session = {
    mutex: new Mutex(),
    chart: { datasets: [] },

    start_at: time,
    start_damage_at: 0,
    last_damage_at: 0,
    total_dmg: 0
  };
  sessions.update(v => {
    v.push(session);
    return v;
  });
  return session;
};

export const removeSession = (session: Session) => {
  mutex.wrap(() => {
    sessions.update(v => {
      v.splice(v.indexOf(session), 1);
      if (get(activeSession) === session) {
        activeSession.set(v[v.length - 1]);
      }
      return v;
    });
  });
};

export const getActor = (data: ActorData) => {
  const $sessions = get(sessions);
  const record = $sessions[$sessions.length - 1];
  let characterId = toHexString(data[2]);

  let actor = record.actors?.find(e => e.player_id === data[1] || (e.party_idx === data[3] && characterId));
  if (!actor) {
    actor = {
      player_id: data[1],
      character_id: characterId,
      party_idx: data[3],
      dmg: 0,
      dmgm: 0,
      hit: 0
    };
    if (!record.actors) record.actors = [];
    record.actors.push(actor);
  }
  return actor;
};

export const getTarget = (actor: ActorRecord, data: ActorData) => {
  let target = actor.targets?.find(e => e.player_id === data[1]);
  if (!target) {
    target = {
      player_id: data[1],
      character_id: toHexString(data[2]),
      party_idx: data[3],
      dmg: 0,
      dmgm: 0,
      hit: 0
    };
    if (!actor.targets) actor.targets = [];
    actor.targets.push(target);
  }
  return target;
};

export const getAction = (actor: ActorRecord, idx: number) => {
  let action = actor.actions?.find(e => e.idx === idx);
  if (!action) {
    action = { idx, hit: 0, dmg: 0, min: -1, max: -1 };
    if (!actor.actions) actor.actions = [];
    actor.actions.push(action);
  }
  return action;
};

export const pruneEvents = (session: Session) => {
  if (!session.mutex) return;

  mutex.wrap(() => {
    session.mutex?.wrap(() => {
      if (!session?.events?.length) return;

      const min_time = +new Date() - 60000;
      while (session.events.length > 0) {
        const event = session.events[0];
        if (event.time > min_time) break;
        session.events.shift();

        const actor = getActor(event.source);
        actor.dmgm -= event.dmg;
        sessions.set(get(sessions));
      }
    });
  });
};

export const calculateDps = (session: Session, chart?: Chart) => {
  if (!session.mutex) return;

  const $_ = get(_);
  mutex.wrap(() => {
    session.mutex?.wrap(() => {
      if (!session?.events?.length || !session.actors) {
        return;
      }

      const full = (session.last_damage_at - session.start_damage_at) / 1000;
      const real = Math.round((+new Date() - session.start_damage_at) / 1000);
      const fullm = Math.min(60, real);

      session.actors.forEach(e => {
        e.dps = Math.floor(e.dmg / full);
        e.dpsm = Math.floor(e.dmgm / fullm);
      });

      if (real > 0 && session.last_chart_update !== session.last_damage_at) {
        if (period > 0) {
          const min_time = real - period;
          session.chart.datasets.forEach(e => {
            const idx = e.data.findIndex(d => d.x > min_time);
            if (idx >= 0) {
              e.data = e.data.slice(idx);
            }
          });
        }

        session.actors.forEach(e => {
          const label = `[${e.party_idx + 1}] ` + $_(`actors.allies.${e.character_id}`);
          let dataset: DataSet | undefined = session.chart.datasets.find(ds => ds.label === label);
          if (!dataset) {
            dataset = {
              label,
              data: [],
              borderColor: colors[e.party_idx],
              backgroundColor: colors[e.party_idx],
              fill: false
            };
            session.chart.datasets.push(dataset);
          }
          dataset.data.push({ x: real, y: e.dpsm || 0 });
        });

        chart?.update();
        session.last_chart_update = session.last_damage_at;
      }

      session.total_dps = session.actors.map(actor => actor.dps).reduce((sum, n) => (sum || 0) + (n || 0));
      sessions.set(get(sessions));
    });
  });
};

export const formatDuration = (start: number, end: number) => {
  const ms = end - start;
  let result;
  if (ms < 1000) {
    result = `${ms}ms`;
  } else {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) result = `${sec}s`;
    else result = `${Math.floor(sec / 60)}m`;
  }
  return result;
};

const zeroPad = (n: number) => n.toString().padStart(2, "0");

export const formatTime = (start: number, end: number) => {
  const t = new Date(start);
  let result = `${zeroPad(t.getHours())}:${zeroPad(t.getMinutes())}:${zeroPad(t.getSeconds())}`;
  if (end - start > 0) {
    result += ` [${formatDuration(start, end)}]`;
  }
  return result;
};

export const toHexString = (number: number) => {
  let hexString = number.toString(16);
  while (hexString.length < 8) {
    hexString = "0" + hexString;
  }
  return hexString;
};

export const isActionValid = (characterId: string, actionId: number) => {
  const $_ = get(_);

  if (!$_(`actions.common.${actionId}`).includes("actions.")) return true;
  return !$_(`actions.${characterId}.${actionId}`).includes("actions.");
};
