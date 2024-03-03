<script lang="ts" context="module">
  import { afterUpdate, onMount } from "svelte";
  import Swiper from "swiper";
  import { Navigation } from "swiper/modules";

  import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
  import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
  import Close from "svelte-material-icons/Close.svelte";

  const debug = false;
</script>

<script lang="ts">
  import html2canvas from "html2canvas";
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
        ++action.hit;

        if (action.min === -1 || action.min > data.damage) action.min = data.damage;
        if (action.max === -1 || action.max < data.damage) action.max = data.damage;

        if (!session.events) session.events = [];
        session.events.push({
          time: time,
          dmg: data.damage,
          source: data.source,
          target: data.target
        });
      });

      sessions.set($sessions);
      if (updateActiveSession) {
        updateActiveSession = false;
        $activeSession = session;

        if (swiper) {
          window.requestAnimationFrame(() => swiper.update());
          window.requestAnimationFrame(() => swiper.slideTo($sessions.indexOf($activeSession)));
        }
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
      Clone2: ""
    } as any;
    const lines = s.split("\n");
    for (let i = 0; i < lines.length; i += 2) {
      let name = lines[i];
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

      columnValues.push(secondCell.textContent, fourthCell.textContent);
    }

    return columnValues.join("\n");
  }

  async function captureChat() {
    copyStatus = "Copying...";
    const valuesStr = await getTableColumnValues();

    const duration = (document.querySelector(".swiper-slide.active").textContent ?? "[0m]").match(/\[[\S\s]+\]/)?.[0];

    await navigator.clipboard.writeText(`${duration} \n${valuesStr.split("\n").join(" \n")}`);
    copyStatus = "Copied!";
  }

  async function captureTab() {
    copyStatus = "Copying...";

    const valuesStr = await getTableColumnValues();
    const values = fillValues(valuesStr);
    const tabValues = Object.values(values).join("\t");

    await navigator.clipboard.writeText(tabValues);

    copyStatus = "Copied!";
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

    copyStatus = "Copied!";
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
</script>

{#if connected}
  {#if $sessions.some(session => session.total_dmg > 0)}
    <div id="main" bind:this={mainDiv}>
      <header>
        <button class="slider-prev" bind:this={prevBtn}>
          <ChevronLeft size="2.1rem" />
        </button>
        <div class="slider-wrapper">
          <div class="swiper" bind:this={swiperRoot}>
            <div class="swiper-wrapper">
              {#each $sessions as session, idx}
                {#if session.total_dmg > 0}
                  <button
                    class={`swiper-slide` + ($activeSession === session ? " active" : "")}
                    type="button"
                    on:click|self={() => ($activeSession = session)}
                  >
                    {formatTime(session.start_damage_at, session.last_damage_at)}
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <span
                      on:click={() => {
                        removeSession(session);
                        if (swiper) {
                          window.requestAnimationFrame(() => swiper.update());
                          if ($activeSession === session) {
                            window.requestAnimationFrame(() => swiper.slideTo($sessions.indexOf($activeSession)));
                          }
                        }
                      }}
                    >
                      <Close size="1.6rem" />
                    </span>
                  </button>
                {/if}
              {/each}
            </div>
          </div>
        </div>
        <button class="slider-next" bind:this={nextBtn}>
          <ChevronRight size="2.1rem" />
        </button>
      </header>
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

    <div>
      <p style="text-align: center">{copyStatus}</p>
      <button id="capture" on:click={capture} class="button">Copy Image</button>
      <button id="capture1" on:click={captureTab} class="button">Copy Tab</button>
      <button id="capture2" on:click={captureChat} class="button">Copy chat</button>
    </div>

    <div>
      <button id="clearAll" on:click={clearAll} class="button">Clear all</button>
    </div>
  {:else}
    <i>Waiting for battle events... </i>
  {/if}
{:else}
  <i>Establishing connection to WebSocket...</i>
{/if}
