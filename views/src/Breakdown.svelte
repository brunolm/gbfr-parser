<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->

<script lang="ts" context="module">
  import { _ } from "svelte-i18n";
  import { get } from "svelte/store";

  import SortAscending from "svelte-material-icons/SortAscending.svelte";
  import SortDescending from "svelte-material-icons/SortDescending.svelte";
  import type { PartyMember } from "./@types/app";
  import { en } from "./en";

  const headers: { key?: keyof ActionRecord; text: string }[] = [
    { text: "Name" },
    { key: "hit", text: "Hits" },
    { key: "dmg", text: "Damage" },
    { key: "min", text: "Min. DMG" },
    { key: "max", text: "Max. DMG" },
    { key: "cap", text: "Cap w/ War" }
  ];

  const targetHeaders: { key?: keyof ActorRecord; text: string }[] = [
    { text: "Target" },
    { key: "dmg", text: "Damage Dealt" }
  ];

  const sigilHeaders: { key?: any; text: string }[] = [
    { text: "Name" },
    { text: "Level" },
    { text: "SubName" },
    { text: "SubLevel" }
  ];
</script>

<script lang="ts">
  export let actor: ActorRecord;
  export let party: PartyMember[];

  let win = window as any;

  let showSigils = localStorage.rememberShowSigils ? localStorage.rememberShowSigils === "true" : true;
  let showDamage = localStorage.rememberShowDamage ? localStorage.rememberShowDamage === "true" : true;

  let targetSortBy: keyof ActorRecord = "dmg";
  let targetDescending = true;

  let actionSortBy: keyof ActionRecord = "dmg";
  let actionDescending = true;

  win._en = en;

  $: {
    actor.targets = actor.targets?.sort((a, b) => {
      const r = targetDescending
        ? Number(a[targetSortBy]) > Number(b[targetSortBy])
        : Number(a[targetSortBy]) < Number(b[targetSortBy]);
      return r ? -1 : 1;
    });
    actor.actions = actor.actions?.sort((a, b) => {
      const r = actionDescending
        ? Number(a[actionSortBy]) > Number(b[actionSortBy])
        : Number(a[actionSortBy]) < Number(b[actionSortBy]);
      return r ? -1 : 1;
    });
  }

  const getActionName = (characterId: string, actionId: number) => {
    const $_ = get(_);
    if (characterId === "26a4848a") {
      characterId = "9498420d";
    }

    let v = $_(`actions.common.${actionId}`);
    if (v.startsWith("actions.")) {
      v = $_(`actions.${characterId}.${actionId}`);
    }
    return v.startsWith("actions.") ? actionId : v;
  };

  const getTargetName = (characterId: string) => {
    const $_ = get(_);

    if (characterId === "26a4848a") {
      characterId = "9498420d";
    }

    let v = $_(`actors.${characterId}`);
    return v ?? characterId;
  };

  const translate = (containerKey, key) => {
    if (!key) {
      return "-";
    }

    const hashKey = key.toString(16).toUpperCase().padStart(8, "0");
    return en.game[containerKey][hashKey] ?? (hashKey === "887AE0B0" ? "" : hashKey);
  };
</script>

<div class="flex" style="justify-content: flex-end">
  <button
    style={`padding: 0.25em 1em; border: 1px solid green;${showSigils ? "background-color: green" : ""}`}
    on:click={() => {
      showSigils = !showSigils;
      localStorage.rememberShowSigils = showSigils;
    }}>Sigils</button
  >
  <button
    style={`padding: 0.25em 1em; border: 1px solid green;${showDamage ? "background-color: green" : ""}`}
    on:click={() => {
      showDamage = !showDamage;

      localStorage.rememberShowDamage = showDamage;
    }}>Damage</button
  >
</div>

<div id="breakdown-tab-sigils" style={showSigils ? "display:block" : "display: none"}>
  {#if party?.length > actor.party_idx}
    <span>
      {en.game.weapons[party[actor.party_idx]?.weapon?.weapon_id.toString(16).toUpperCase()] ?? "-"}
    </span>

    {#if Array.isArray(party[actor.party_idx]?.over_mastery)}
      <div class="breakdown-h2">Over Mastery</div>

      <div class="grid-container border-0">
        {#each party[actor.party_idx]?.over_mastery as overMastery}
          <div>
            {en.game.over_mastery[overMastery.type_id.toString(16).toUpperCase()]} lv.{overMastery.level ?? "-"}
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  <div class="breakdown-h2">Sigils</div>
  <table>
    <colgroup>
      <col span="1" />
      <col width="70" />
      <col width="200" />
      <col width="70" />
    </colgroup>
    <thead>
      <tr>
        {#each sigilHeaders as header}
          <th
            scope="col"
            class={header.key ? "sortable" : undefined}
            data-active={actionSortBy === header.key || undefined}
            on:click={header.key
              ? () => {
                  if (header.key) actionSortBy = header.key;
                  actionDescending = !actionDescending;
                }
              : undefined}
          >
            {#if actionSortBy === header.key}
              <svelte:component this={actionDescending ? SortDescending : SortAscending} size="2.1rem" />
            {/if}
            {header.text}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if party?.length > actor.party_idx}
        <tr>
          <td></td>
          <td></td>
          <td>{translate("skills", party[actor.party_idx]?.weapon.skill1)}</td>
          <td>{party[actor.party_idx]?.weapon.skill1_lv ?? "-"}</td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td>{translate("skills", party[actor.party_idx]?.weapon.skill2)}</td>
          <td>{party[actor.party_idx]?.weapon.skill2_lv ?? "-"}</td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td>{translate("skills", party[actor.party_idx]?.weapon.skill3)}</td>
          <td>{party[actor.party_idx]?.weapon.skill3_lv ?? "-"}</td>
        </tr>

        {#if Array.isArray(party[actor.party_idx]?.sigils)}
          {#each party[actor.party_idx]?.sigils as sigil}
            <tr>
              <td>{translate("skills", sigil.first_trait_id)}</td>
              <td>{sigil.first_trait_level}</td>
              <td>{translate("skills", sigil.second_trait_id)}</td>
              <td>{sigil.second_trait_level}</td>
            </tr>
          {/each}
        {/if}
      {/if}
    </tbody>
  </table>
</div>

<div id="breakdown-tab-damage" style={showDamage ? "display:block" : "display: none"}>
  <div class="breakdown-h2 border-0">Damage</div>

  <table>
    <colgroup>
      <col span="1" />
      <col width="70" />
      <col width="110" />
      <col width="125" />
      <col width="125" />
      <col width="100" />
    </colgroup>
    <thead>
      <tr>
        {#each headers as header}
          <th
            scope="col"
            class={header.key ? "sortable" : undefined}
            data-active={actionSortBy === header.key || undefined}
            on:click={header.key
              ? () => {
                  if (header.key) actionSortBy = header.key;
                  actionDescending = !actionDescending;
                }
              : undefined}
          >
            {#if actionSortBy === header.key}
              <svelte:component this={actionDescending ? SortDescending : SortAscending} size="2.1rem" />
            {/if}
            {header.text}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if actor.actions?.length}
        {#each actor.actions || [] as action}
          <tr>
            <td>
              <span title={`${action.idx}`}>
                {getActionName(actor.character_id, action.idx)}
              </span>
            </td>
            <td>{action.hit.toLocaleString()}</td>
            <td>{action.dmg.toLocaleString()}</td>
            <td>{action.min.toLocaleString()}</td>
            <td>{action.max.toLocaleString()}</td>
            <td>{action.capWar?.toLocaleString() ?? 0}</td>
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>

  {#if actor.targets?.length}
    <div>
      <table>
        <colgroup>
          <col span="1" />
          <col width="250" />
        </colgroup>
        <thead>
          <tr>
            {#each targetHeaders as header}
              <th
                scope="col"
                class={header.key ? "sortable" : undefined}
                data-active={targetSortBy === header.key || undefined}
                on:click={header.key
                  ? () => {
                      if (header.key) targetSortBy = header.key;
                      targetDescending = !targetDescending;
                    }
                  : undefined}
              >
                {#if targetSortBy === header.key}
                  <svelte:component this={targetDescending ? SortDescending : SortAscending} size="2.1rem" />
                {/if}
                {header.text}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each actor.targets as target}
            <tr>
              <td>{$_(`actors.enemies.${target.character_id}`)}</td>
              <td>{target.dmg.toLocaleString()}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
