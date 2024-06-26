<script lang="ts" context="module">
  import Chart from "chart.js/auto";
  import { onDestroy, onMount } from "svelte";
  import { _ } from "svelte-i18n";

  import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
  import ChevronUp from "svelte-material-icons/ChevronUp.svelte";
  import SortAscending from "svelte-material-icons/SortAscending.svelte";
  import SortDescending from "svelte-material-icons/SortDescending.svelte";
  import { get } from "svelte/store";
  import dmgcap from "./dmgcap.json";
  import { en } from "./en";

  const headers: { key?: keyof ActorRecord; text: string; title?: string }[] = [
    { key: "party_idx", text: "#" },
    { text: "Name" },
    { key: "dmg", text: "Damage" },
    { key: "dps", text: "DPS" },
    { key: "pdmg", text: "PrimaryDamage", title: "Damage dealt to the primary target only (boss)" },
    { key: "pdps", text: "PDPS", title: "DPS dealt to the primary target only (boss)" },
    { key: "percentage", text: "%", title: "Damage contribution to the entire fight" }
  ];
</script>

<script lang="ts">
  import Breakdown from "./Breakdown.svelte";
  import { colors } from "./lib/Constants";
  import { sessions } from "./lib/Stores";
  import { calculateDps, formatDuration, getHash, pruneEvents } from "./lib/Utils";

  export let session: Session;

  const win = window as any;

  let sortBy: keyof ActorRecord = localStorage.sortBy ?? "dmg";
  let descending = localStorage.sortByDescending === "false" ? false : true;

  let chart: Chart | undefined;
  let canvas: HTMLCanvasElement;

  let showCanvas = localStorage.rememberShowCanvas ? localStorage.rememberShowCanvas === "true" : false;
  let destroyed = false;
  let partyIdx = localStorage.rememberPartyIdx ? Number(localStorage.rememberPartyIdx) : -1;

  let cheatingInfo = {};

  let showNames = localStorage.rememberShowName ? localStorage.rememberShowName === "true" : false;

  function toggleShowNames() {
    showNames = !showNames;
    localStorage.rememberShowName = showNames;
  }

  function addCheatingHeaderMessage(cheatingInfo, actor) {
    if (!cheatingInfo[actor.party_idx]) {
      cheatingInfo[actor.party_idx] = "Possible cheating detected\n";
    }
  }

  $: {
    session.actors = session.actors?.sort((a, b) => {
      if (descending) {
        return Number(a[sortBy]) > Number(b[sortBy]) ? -1 : 1;
      }
      return Number(a[sortBy]) < Number(b[sortBy]) ? -1 : 1;
    });

    if (Array.isArray(session.actors)) {
      for (const actor of session.actors) {
        actor.cheating = false;
        if (!Array.isArray(actor.actions)) {
          continue;
        }
        cheatingInfo[actor.party_idx] = "";
        for (const action of actor.actions) {
          const cap = dmgcap.actions?.[actor.character_id]?.[action.idx];

          if (!cap || Number.isNaN(cap)) {
            continue;
          }

          if (action.max > cap) {
            addCheatingHeaderMessage(cheatingInfo, actor);

            actor.cheating = true;
            cheatingInfo[actor.party_idx] +=
              `${$_(`actors.allies.${actor.character_id}`)} -> ${$_(`actions.${actor.character_id}.${action.idx}`)} (${action.idx}) -> ` +
              `Dmg: ${action.max.toLocaleString()} / Cap: ${cap.toLocaleString()} / Diff: ${(action.max - cap).toLocaleString()}\n`;
          }
        }

        // WrightStone check
        const partyPlayer = session.party[actor.party_idx];
        const wsSkill1 = getHash(partyPlayer.weapon.skill1);
        const wsSkill2 = getHash(partyPlayer.weapon.skill2);
        const wsSkill3 = getHash(partyPlayer.weapon.skill3);

        const notAllowedWrightstone = [
          "57AB5B10",
          "82CE278D",
          "1568E0E4",
          "70395731",
          "CD18A77D",
          "333E5862",
          "A8A3163B",
          "EC1C6779",
          "DBE1D775",
          "8D2ADB6E",
          "5C862E13",
          "082033CB",
          "1B0D9897",
          "9AD8B5E6",
          "40223C28",
          "74AA75D6",
          "DC225C96",
          "4C588C27",
          "5E422AE5",
          "AF794A87",
          "57AB5B10"
        ];
        const hasCheatedWrightStone =
          notAllowedWrightstone.includes(wsSkill1) ||
          notAllowedWrightstone.includes(wsSkill2) ||
          notAllowedWrightstone.includes(wsSkill3);

        if (hasCheatedWrightStone) {
          actor.cheating = true;

          addCheatingHeaderMessage(cheatingInfo, actor);
          cheatingInfo[actor.party_idx] += `Modified wrightstone: invalid skill`;
        }

        if (partyPlayer.weapon.skill1_lv > 10) {
          actor.cheating = true;

          addCheatingHeaderMessage(cheatingInfo, actor);
          cheatingInfo[actor.party_idx] += `Modified wrightstone: over level 10\n`;
        }

        if (partyPlayer.weapon.skill2_lv > 7) {
          actor.cheating = true;

          addCheatingHeaderMessage(cheatingInfo, actor);
          cheatingInfo[actor.party_idx] += `Modified wrightstone: over level 7\n`;
        }

        if (partyPlayer.weapon.skill3_lv > 5) {
          actor.cheating = true;

          addCheatingHeaderMessage(cheatingInfo, actor);
          cheatingInfo[actor.party_idx] += `Modified wrightstone: over level 5\n`;
        }

        // Sigils check
        for (const sigil of partyPlayer.sigils) {
          if (sigil.first_trait_level > 15 || sigil.second_trait_level > 15 || sigil.sigil_level > 15) {
            actor.cheating = true;

            addCheatingHeaderMessage(cheatingInfo, actor);
            cheatingInfo[actor.party_idx] += `Modified sigil: over level 15\n`;
          }
          const sigilTrait1 = getHash(sigil.first_trait_id);
          const sigilTrait2 = getHash(sigil.second_trait_id);

          const isLucySigil = sigilTrait1 === "DBE1D775" || sigilTrait1 === "8D2ADB6E" || sigilTrait1 === "5C862E13";
          if (isLucySigil && sigilTrait2 !== "DC584F60") {
            actor.cheating = true;

            addCheatingHeaderMessage(cheatingInfo, actor);
            const invalidSub = en.game.skills[sigilTrait2] ?? sigilTrait2;
            cheatingInfo[actor.party_idx] += `Modified sigil: Lucy sigil with invalid second trait: ${invalidSub}\n`;
          }

          const isWarElemental = sigilTrait1 === "4C588C27";
          if (isWarElemental && sigilTrait2 !== "887AE0B0") {
            actor.cheating = true;

            addCheatingHeaderMessage(cheatingInfo, actor);
            const invalidSub = en.game.skills[sigilTrait2] ?? sigilTrait2;
            cheatingInfo[actor.party_idx] +=
              `Modified sigil: War Elemental sigil with invalid second trait: ${invalidSub}\n`;
          }
        }
      }
    }
  }
  $: if (showCanvas && canvas && !chart) {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      chart = new Chart(ctx, {
        type: "line",
        data: session.chart,
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            x: {
              type: "linear",
              position: "bottom",
              title: {
                display: true,
                text: "Time (seconds)"
              }
            },
            y: {
              //beginAtZero: true,
              position: "left",
              title: {
                display: true,
                text: "DPS"
              }
            }
          },
          animations: {
            y: { duration: 0 }
          },
          elements: {
            point: { radius: 0 }
          }
        }
      });
    }
  }

  const updateEvents = () => {
    if (!session.mutex) return;
    if (session?.last_damage_at > 0) {
      pruneEvents(session);
      calculateDps(session, chart);
    }

    if (!destroyed && $sessions.indexOf(session) >= 0) {
      setTimeout(updateEvents, 1000);
    }
  };

  onMount(updateEvents);
  onDestroy(() => (destroyed = true));

  const getTargetName = (characterId: string) => {
    const $_ = get(_);

    if (characterId === "26a4848a") {
      characterId = "9498420d";
    }

    let v = $_(`actors.enemies.${characterId}`);
    return v ?? characterId;
  };

  let maxDmgCharacterId: any;
  $: {
    let dmgSums: any = {};

    if (Array.isArray(session.actors)) {
      for (let actor of session.actors!) {
        actor.pdmg = getPrimaryTargetDamage(actor);
        actor.pdps = getPrimaryTargetDps(actor);
        if (actor?.targets && Array.isArray(actor?.targets)) {
          for (let target of actor?.targets!) {
            if (!dmgSums[target.character_id]) {
              dmgSums[target.character_id] = 0;
            }
            dmgSums[target.character_id] += target.dmg;
          }
        }
      }

      maxDmgCharacterId = Object.keys(dmgSums).reduce((a, b) => (dmgSums[a] > dmgSums[b] ? a : b), 0);
    }
  }

  const getTargetsDamage = (actor: ActorRecord) => {
    if (!actor?.targets) {
      return 0;
    }

    return actor.targets.map(t => t.dmg).reduce((a, b) => a + b, 0);
  };
  const getTargetsDps = (actor: ActorRecord) => {
    if (!actor?.targets) {
      return 0;
    }

    const totalDurationInSeconds = (session.last_damage_at - session.start_damage_at) / 1000;

    return Math.floor(getTargetsDamage(actor) / totalDurationInSeconds);
  };

  const getPrimaryTargetDamage = (actor: ActorRecord) => {
    if (!actor?.targets) {
      return 0;
    }

    return Math.max(...actor.targets.map(t => t.dmg));
  };
  const getPrimaryTargetDps = (actor: ActorRecord) => {
    if (!actor?.targets) {
      return 0;
    }

    const totalDurationInSeconds = (session.last_damage_at - session.start_damage_at) / 1000;

    return Math.floor(getPrimaryTargetDamage(actor) / totalDurationInSeconds);
  };

  const getCharacterName = (actor: ActorRecord) => {
    const name = en.game.actors[actor.character_key];

    if (!name) {
      return $_(`actors.allies.${actor.character_id}`);
    }

    return name;
  };
</script>

{#if session.actors && session.total_dmg > 0}
  <div style="text-align: center; padding: 1em;">
    <h2>
      {getTargetName(maxDmgCharacterId)} [{formatDuration(session.start_damage_at, session.last_damage_at)}]
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <span style="float: right; cursor: pointer" on:click={() => (partyIdx = partyIdx === -100 ? -1 : -100)}>
        expand/collapse all
      </span>
    </h2>
  </div>
  <table>
    <colgroup>
      <col width="30" />
      <col width="180" />
      <col span="1" />
      <col span="1" />
      <col span="1" />
      <col span="1" />
      <col width="35" />
    </colgroup>
    <thead>
      <tr>
        {#each headers as header}
          <th
            scope="col"
            class={header.key ? "sortable" : undefined}
            data-active={sortBy === header.key || undefined}
            on:click={header.key
              ? () => {
                  if (header.key) {
                    sortBy = header.key;
                    localStorage.sortBy = sortBy;
                  }
                  descending = !descending;
                  localStorage.sortByDescending = descending;
                }
              : undefined}
            title={header.title ?? ""}
          >
            {#if sortBy === header.key}
              <svelte:component this={descending ? SortDescending : SortAscending} size="2.1rem" />
            {/if}

            {#if header.text === "Name"}
              <input type="checkbox" bind:checked={showNames} title="Show names" on:click={toggleShowNames} />
            {/if}

            {header.text}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each session.actors as actor}
        {#if actor.party_idx >= 0 && actor.dmg > 0}
          <tr class="dmg-row">
            <td>{actor.party_idx + 1}</td>
            <td style={`color: ${colors[actor.party_idx]}`}>
              {#if showNames && session.party?.[actor.party_idx]?.d_name}
                {session.party?.[actor.party_idx]?.d_name} -{" "}
              {/if}
              {getCharacterName(actor)}

              {#if actor.cheating}
                <span title={cheatingInfo[actor.party_idx]}>(Cheating?)</span>
              {/if}
            </td>
            <td>{actor.dmg.toLocaleString()}</td>
            <td>{(actor.dps || getTargetsDps(actor) || 0).toLocaleString()}</td>
            <td>{getPrimaryTargetDamage(actor).toLocaleString()}</td>
            <td>{getPrimaryTargetDps(actor).toLocaleString()}</td>
            <td>{(Number(actor.percentage || 0) * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%</td>
            <td style="padding: 0">
              <button
                type="button"
                style="width: 100%"
                on:click={() => {
                  partyIdx = partyIdx === actor.party_idx ? -1 : actor.party_idx;

                  if (partyIdx === -1 || partyIdx === 0) {
                    localStorage.rememberPartyIdx = partyIdx;
                  }
                }}
              >
                {#if partyIdx === actor.party_idx}
                  <ChevronUp size="2.5rem" />
                {:else}
                  <ChevronDown size="2.5rem" />
                {/if}
              </button>
            </td>
          </tr>
          {#if partyIdx === actor.party_idx || partyIdx === -100}
            <tr>
              <td colspan="100">
                <Breakdown {actor} party={session.party} />
              </td>
            </tr>
          {/if}
        {/if}
      {/each}
    </tbody>
    {#if session.actors.length > 1}
      <tfoot>
        <tr>
          <th></th>
          <th></th>
          <th>{session.total_dmg.toLocaleString()}</th>
          <th>{(session.total_dps || 0).toLocaleString()}</th>
          <th
            >{session.actors
              .reduce((a, b) => {
                return a + getPrimaryTargetDamage(b);
              }, 0)
              .toLocaleString()}</th
          >
          <th
            >{session.actors
              .reduce((a, b) => {
                return a + getPrimaryTargetDps(b);
              }, 0)
              .toLocaleString()}</th
          >
        </tr>
      </tfoot>
    {/if}
  </table>
  <button
    type="button"
    on:click={() => {
      showCanvas = !showCanvas;
      localStorage.rememberShowCanvas = showCanvas;
      if (!showCanvas) {
        chart = undefined;
      }
    }}
  >
    <svelte:component this={showCanvas ? ChevronUp : ChevronDown} size="2.5rem" />
  </button>
  {#if showCanvas}
    <canvas bind:this={canvas} />
  {/if}
{/if}
