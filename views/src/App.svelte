<script lang="ts" context="module">
  import { afterUpdate, onMount } from "svelte";
  import Swiper from "swiper";
  import { Navigation } from "swiper/modules";

  import Close from "svelte-material-icons/Close.svelte";

  const debug = false;
</script>

<script lang="ts">
  import html2canvas from "html2canvas";
  import { _ } from "svelte-i18n";
  import { get } from "svelte/store";
  import Session from "./Session.svelte";
  import { activeSession, mutex, sessions } from "./lib/Stores";
  import {
    createSession,
    formatTime,
    getAction,
    getActor,
    getTarget,
    loadSavedSessions,
    removeSession,
    saveSessions
  } from "./lib/Utils";

  const win = window as any;

  let ws: WebSocket;
  let updateActiveSession = false;
  let connected = false;

  let swiperRoot: HTMLElement;
  let prevBtn: HTMLElement;
  let nextBtn: HTMLElement;
  let swiper: Swiper;

  const onDamage = (data: EventData, time: number) => {
    mutex.wrap(async () => {
      if (data.source[3] === -1 || data.damage <= 0 || data.target[2] === 36320527) return;

      let session = $sessions[$sessions.length - 1];
      if (!session || session.done) {
        session = createSession(time);
        updateActiveSession = true;
      } else if (session.mutex) {
        await session.mutex.wrap(() => {
          session.last_damage_at = time;
        });
      } else return;

      if (session.mutex && !session.start_damage_at) {
        await session.mutex.wrap(() => {
          session.start_damage_at = time;
        });
      }

      await session.mutex?.wrap(() => {
        session.total_dmg += data.damage;
        session.party = data.party;

        const actor = getActor(data.source);
        const target = getTarget(actor, data.target);

        if (target.character_id === "022a350f") return;

        actor.dmg += data.damage;
        actor.dmgm += data.damage;
        ++actor.hit;

        session.actors?.forEach(e => (e.percentage = e.dmg / session.total_dmg));

        target.dmg += data.damage;

        const action = getAction(actor, data.flags & (1 << 15) ? -3 : data.action_id);
        action.dmg += data.damage;
        action.capWar = Math.max(0, data.dmgCap + data.dmgCap * 0.2);
        action.cap = Math.max(0, data.dmgCap);
        ++action.hit;

        if (action.min === -1 || action.min > data.damage) action.min = data.damage;
        if (action.max === -1 || action.max < data.damage) action.max = data.damage;

        if (!session.events) session.events = [];
        session.events.push({
          time: time,
          dmg: data.damage,
          capWar: data.dmgCap + data.dmgCap * 0.2,
          cap: data.dmgCap,
          source: data.source,
          target: data.target
        });
      });

      sessions.set($sessions);
      if (updateActiveSession) {
        updateActiveSession = false;
        $activeSession = session;
      }
    });
  };

  afterUpdate(() => {
    if (swiperRoot && !swiper) {
      swiper = new Swiper(swiperRoot, {
        slidesPerView: "auto",
        centeredSlides: false,
        allowTouchMove: false,
        freeMode: true,
        navigation: {
          nextEl: ".slider-next",
          prevEl: ".slider-prev"
        },
        modules: [Navigation]
      });

      window.requestAnimationFrame(() => swiper.slideTo($sessions.indexOf($activeSession)));
    }
  });

  let mainDiv: HTMLElement;
  let copyStatus = "";

  function fillValues(s: any) {
    const obj = {
      Cagliostro: "",
      Charlotta: "",
      Eugen: "",
      Ferry: "",
      Ghandagoza: "",
      "Gran/Djeeta": "",
      Id: "",
      Io: "",
      Katalina: "",
      Lancelot: "",
      Narmaya: "",
      Percival: "",
      Rackam: "",
      Rosetta: "",
      Siegfried: "",
      Vane: "",
      Vaseraga: "",
      Yodarha: "",
      Zeta: "",
      Clone1: "",
      Clone2: "",
      Clone3: ""
    } as any;
    const lines = s.split("\n");
    for (let i = 0; i < lines.length; i += 2) {
      let name = lines[i].replace(/^[\S\s]+[-]\s*/, "");
      const value = lines[i + 1];

      if (name === "Gran" || name === "Djeeta") {
        name = "Gran/Djeeta";
      }

      if (obj.hasOwnProperty(name)) {
        if (obj[name] === "") {
          obj[name] = value;
        } else if (obj["Clone1"] === "") {
          obj["Clone1"] = value;
        } else if (obj["Clone2"] === "") {
          obj["Clone2"] = value;
        } else if (obj["Clone3"] === "") {
          obj["Clone3"] = value;
        }
      }
    }

    return obj;
  }

  // copy text
  async function getTableColumnValues() {
    const trs = document.querySelectorAll("main table tbody tr.dmg-row") as any;

    const columnValues = [];

    for (let i = 0; i < trs.length; i++) {
      const secondCell = trs[i].cells[1]; // Index is 0-based
      const fourthCell = trs[i].cells[3]; // Index is 0-based

      columnValues.push(
        secondCell.textContent?.replace(/\n/g, "")?.trim(),
        fourthCell.textContent?.replace(/\n/g, "")?.trim()
      );
    }

    return columnValues.join("\n");
  }
  async function getTableColumnValuesPdps() {
    const trs = document.querySelectorAll("main table tbody tr.dmg-row") as any;

    const columnValues = [];

    for (let i = 0; i < trs.length; i++) {
      const secondCell = trs[i].cells[1]; // Index is 0-based
      const fourthCell = trs[i].cells[5]; // Index is 0-based

      columnValues.push(
        secondCell.textContent?.replace(/\n/g, "")?.trim(),
        fourthCell.textContent?.replace(/\n/g, "")?.trim()
      );
    }

    return columnValues.join("\n");
  }

  async function captureChat() {
    copyStatus = "Copying...";
    const valuesStr = await getTableColumnValues();

    const duration = (document.querySelector(".active").textContent ?? "[0m]").match(/\[[\S\s]+\]/)?.[0];

    await navigator.clipboard.writeText(`${duration} \n${valuesStr.split("\n").join(" \n")}`);
    copyStatus = "Copied: chat dps";
  }

  async function captureChatPdps() {
    copyStatus = "Copying...";
    const valuesStr = await getTableColumnValuesPdps();

    const duration = (document.querySelector(".active").textContent ?? "[0m]").match(/\[[\S\s]+\]/)?.[0];

    await navigator.clipboard.writeText(`${duration} \n${valuesStr.split("\n").join(" \n")}`);
    copyStatus = "Copied: chat pdps";
  }

  async function captureTab() {
    copyStatus = "Copying...";

    const valuesStr = await getTableColumnValues();
    const values = fillValues(valuesStr);
    const tabValues = Object.values(values).join("\t");

    await navigator.clipboard.writeText(tabValues);

    copyStatus = "Copied: tab dps";
  }

  async function captureTabPdps() {
    copyStatus = "Copying...";

    const valuesStr = await getTableColumnValuesPdps();
    const values = fillValues(valuesStr);
    const tabValues = Object.values(values).join("\t");

    await navigator.clipboard.writeText(tabValues);

    copyStatus = "Copied: tab pdps";
  }

  async function capture() {
    copyStatus = "Copying... Do not change tabs!";

    const canvas = await html2canvas(mainDiv);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob
        } as any)
      ]);
      console.log("Image copied to clipboard");
    } catch (err) {
      console.error(err);
      copyStatus = err;
    }

    copyStatus = "Copied: image";
  }

  async function saveAll() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify($sessions));
    const downloadAnchorElem = document.createElement("a");
    downloadAnchorElem.setAttribute("href", dataStr);
    downloadAnchorElem.setAttribute("download", "gbfr-parse-data.json");

    document.body.appendChild(downloadAnchorElem);
    downloadAnchorElem.click();
    downloadAnchorElem.remove();
  }

  async function loadFromFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = async e => {
          const content = e.target?.result;
          if (typeof content === "string") {
            try {
              const data = JSON.parse(content);
              if (Array.isArray(data)) {
                $sessions = data;
                $sessions = await saveSessions();

                $activeSession = $sessions[$sessions.length - 1];
              }
            } catch (e) {
              console.error(e);
            }
          }
        };
        reader.readAsText(input.files[0]);
      }
    };
    input.click();
  }

  async function clearAll() {
    if (confirm("Are you sure you want to clear all data?")) {
      $sessions = [];
      $activeSession = null;
      saveSessions();
    }
  }

  onMount(async () => {
    const savedSessions = await loadSavedSessions();
    if (savedSessions) {
      $sessions = savedSessions;
      $activeSession = $sessions[$sessions.length - 1];
    }

    const init = () => {
      ws = new WebSocket("ws://localhost:24399");
      ws.addEventListener("message", ev => {
        if (debug) {
          console.debug(ev);
        }

        const msg: Message = JSON.parse(ev.data);
        if (!msg.time_ms) {
          msg.time_ms = +new Date();
        }
        switch (msg.type) {
          case "enter_area":
            createSession(msg.time_ms);
            updateActiveSession = true;
            break;
          case "damage":
            onDamage(msg.data, msg.time_ms);
            break;
          case "load_party":
            const party = (msg.data as any) ?? (window as any)._party ?? [];
            (window as any)._party = party;
            $activeSession.party = party;

            break;
        }
      });
      ws.addEventListener("open", () => (connected = true));
      ws.addEventListener("close", () => setTimeout(init, 1000));
      ws.addEventListener("error", console.error);
    };

    init();

    const save = () => {
      saveSessions();
      window.setTimeout(save, 3000);
    };
    save();
  });

  const getTargetName = (characterId: string) => {
    if (!characterId) return "Target";
    const $_ = get(_);

    if (characterId === "26a4848a") {
      characterId = "9498420d";
    }

    let v = $_(`actors.enemies.${characterId}`);
    return v ?? characterId;
  };

  const getTargetMostDamageTaken = (session: globalThis.Session) => {
    if (!session || !session.actors) return;
    let maxDmgCharacterId: any;

    let dmgSums: any = {};

    for (let actor of session.actors!) {
      if (actor?.targets && Array.isArray(actor?.targets)) {
        for (let target of actor?.targets!) {
          if (!dmgSums[target.character_id]) {
            dmgSums[target.character_id] = 0;
          }
          dmgSums[target.character_id] += target.dmg;
        }
      }
    }

    maxDmgCharacterId = Object.keys(dmgSums).reduce((a, b) => (dmgSums[a] > dmgSums[b] ? a : b));

    return maxDmgCharacterId;
  };

  let showVerticalTabs = localStorage.rememberShowVerticalTabs
    ? localStorage.rememberShowVerticalTabs === "true"
    : true;

  const expandCollapse = () => {
    showVerticalTabs = !showVerticalTabs;
    localStorage.rememberShowVerticalTabs = showVerticalTabs;
  };
</script>

{#if connected}
  {#if $sessions.some(session => session.total_dmg > 0)}
    <div class="flex container">
      <button class="expand-collapse" on:click={expandCollapse}>
        {#if showVerticalTabs}
          ➡️
        {:else}
          ⬅️
        {/if}
      </button>

      {#if showVerticalTabs}
        <div class="vertical-tabs">
          {#each [...$sessions].reverse() as session, idx}
            {#if session.total_dmg > 0}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <button
                class={`item` + ($activeSession === session ? " active" : "")}
                type="button"
                on:click|self={() => {
                  win.session = session;
                  $activeSession = session;
                }}
              >
                {getTargetName(getTargetMostDamageTaken(session))}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <span
                  style="font-size: 12px"
                  on:click|self={() => {
                    win.session = session;
                    $activeSession = session;
                  }}
                >
                  {formatTime(session.start_damage_at, session.last_damage_at)}
                </span>
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <span
                  class="remove-session"
                  on:click={() => {
                    removeSession(session);
                  }}
                >
                  <Close size="1.6rem" />
                </span>
              </button>
            {/if}
          {/each}
        </div>
      {/if}
      <div class="main-container">
        <div id="main" bind:this={mainDiv}>
          <main>
            {#each $sessions as session (session.start_at)}
              {#if $activeSession === session}
                {#key session.start_at}
                  <Session bind:session />
                {/key}
              {/if}
            {/each}
          </main>
        </div>

        <div class="buttons-container">
          <div>
            <p style="text-align: center">
              {#if copyStatus}
                {copyStatus}
              {/if}
              {#if !copyStatus}
                &nbsp;
              {/if}
            </p>
            <button id="capture" on:click={capture} class="button">Copy Image</button>
            <button id="capturechatdps" on:click={captureChat} class="button">Copy chat dps</button>
            <button id="capturechatpdps" on:click={captureChatPdps} class="button">Copy chat pdps</button>
          </div>

          <div class="buttons-container">
            <button id="saveAll" on:click={saveAll} class="button button-sm">Save All</button>
            <button id="loadAll" on:click={loadFromFile} class="button button-sm">Load file</button>
            <button id="clearAll" on:click={clearAll} class="button button-sm">Clear all</button>
          </div>

          <div class="buttons-container">
            <details>
              <summary>Spreadsheet commands</summary>
              <button id="capturetabdps" on:click={captureTab} class="button">Copy Tab</button>
              <button id="capturetabpdps" on:click={captureTabPdps} class="button">Copy Tab PDPS</button>
            </details>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <p>
      <i>Waiting for battle events... </i>
      <button id="loadAll2" on:click={loadFromFile} class="button button-sm">Load file</button>
    </p>
  {/if}
{:else}
  <i>Establishing connection to WebSocket...</i>
{/if}
