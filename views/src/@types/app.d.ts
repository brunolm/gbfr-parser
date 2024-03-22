import { Mutex } from "../lib/Utils";

declare global {
  interface Message {
    type: "enter_area" | "damage" | "load_party";
    time_ms: number;
    data: EventData;
  }

  interface EventData {
    action_id: number;
    damage: number;
    flags: number;
    source: ActorData;
    target: ActorData;
    dmgCap: number;
    flags: number;
    attackRate: number;
    party: PartyMember[];
  }

  // [0]source_type, [1]player_id, [2]character_id, [3]party_idx
  type ActorData = [string, number, number, number];

  interface EventRecord {
    time: number;
    dmg: number;
    source: ActorData;
    target: ActorData;
    cap: number;
    capWar: number;
    attackRate?: number;
  }

  interface ActionRecord {
    idx: number;
    hit: number;
    dmg: number;
    min: number;
    max: number;
    cap: number;
    capWar: number;
    attackRate?: number;
  }

  interface ActorRecord {
    cheating?: boolean;
    player_id: number;
    character_id: string;
    character_key: string;
    party_idx: number;

    dmg: number;
    pdmg: number;
    pdps: number;
    dmgm: number;
    hit: number;

    dps?: number;
    dpsm?: number;
    percentage?: number;

    targets?: ActorRecord[];
    actions?: ActionRecord[];
  }

  interface Session {
    mutex?: Mutex;
    done?: boolean;
    chart: ChartData;

    start_at: number;
    start_damage_at: number;
    last_damage_at: number;
    total_dmg: number;
    total_dps?: number;
    events?: EventRecord[];
    actors?: ActorRecord[];
    last_chart_update?: number;

    party: PartyMember[];
  }

  interface DataSet {
    label: string;
    data: { x: number; y: number }[];
    borderColor: string;
    backgroundColor: string;
    fill: boolean;
  }

  interface ChartData {
    datasets: DataSet[];
  }
}

type Weapon = {
  weapon_id: number;
  skill1: number;
  skill1_lv: number;
  skill2: number;
  skill2_lv: number;
  skill3: number;
  skill3_lv: number;
  bless_item: number;
};

type Sigil = {
  first_trait_id: number;
  first_trait_level: number;
  second_trait_id: number;
  second_trait_level: number;
  sigil_id: number;
  sigil_level: number;
};

interface PartyMember {
  c_name: string;
  d_name: string;
  is_online: 0 | 1;
  sigils: Sigil[];
  weapon: Weapon;
}
