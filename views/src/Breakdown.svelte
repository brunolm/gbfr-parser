<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->

<script lang="ts" context="module">
  import { _ } from "svelte-i18n";
  import { get } from "svelte/store";

  import SortAscending from "svelte-material-icons/SortAscending.svelte";
  import SortDescending from "svelte-material-icons/SortDescending.svelte";

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
</script>

<script lang="ts">
  export let actor: ActorRecord;

  let targetSortBy: keyof ActorRecord = "dmg";
  let targetDescending = true;

  let actionSortBy: keyof ActionRecord = "dmg";
  let actionDescending = true;

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
</script>

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
            <span title={action.idx}>
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
