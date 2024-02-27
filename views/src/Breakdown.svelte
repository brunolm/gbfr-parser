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
    { key: "max", text: "Max. DMG" }
  ];

  const headersTarget: { key?: any; text: string }[] = [
    { key: "target", text: "Target" },
    { key: "dmg", text: "Damage" }
  ];
</script>

<script lang="ts">
  export let actor: ActorRecord;

  let sortBy: keyof ActionRecord = "dmg";
  let descending = true;
  let sortByTarget = "dmg";
  let descendingTarget = true;

  $: {
    actor.actions = actor.actions?.sort((a, b) => {
      if (descending) {
        return Number(a[sortBy]) > Number(b[sortBy]) ? -1 : 1;
      }
      return Number(a[sortBy]) < Number(b[sortBy]) ? -1 : 1;
    });
  }

  $: {
    actor.targets = (actor.targets as any)?.sort((a: any, b: any) => {
      if (descendingTarget) {
        return Number(a[sortByTarget]) > Number(b[sortByTarget]) ? -1 : 1;
      }
      return Number(a[sortByTarget]) < Number(b[sortByTarget]) ? -1 : 1;
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

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<table>
  <thead>
    <tr>
      {#each headers as header}
        <th
          scope="col"
          class={header.key ? "sortable" : undefined}
          data-active={sortBy === header.key || undefined}
          on:click={header.key
            ? () => {
                if (header.key) sortBy = header.key;
                descending = !descending;
              }
            : undefined}
        >
          {#if sortBy === header.key}
            <svelte:component this={descending ? SortDescending : SortAscending} size="2.1rem" />
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
          <td>{getActionName(actor.character_id, action.idx)}</td>
          <td>{action.hit.toLocaleString()}</td>
          <td>{action.dmg.toLocaleString()}</td>
          <td>{action.min.toLocaleString()}</td>
          <td>{action.max.toLocaleString()}</td>
        </tr>
      {/each}
    {/if}
  </tbody>
</table>

<hr />

<table>
  <thead>
    <tr>
      {#each headersTarget as header}
        <th
          scope="col"
          class={header.key ? "sortable" : undefined}
          data-active={sortByTarget === header.key || undefined}
          on:click={header.key
            ? () => {
                if (header.key) sortByTarget = header.key;
                descending = !descending;
              }
            : undefined}
        >
          {#if sortByTarget === header.key}
            <svelte:component this={descending ? SortDescending : SortAscending} size="2.1rem" />
          {/if}
          {header.text}
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#if actor.targets?.length}
      {#each actor.targets || [] as target}
        <tr>
          <td>{getTargetName(target.character_id)}</td>
          <td>{target.dmg}</td>
        </tr>
      {/each}
    {/if}
  </tbody>
</table>
