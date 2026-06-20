import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const startButton = document.querySelector<HTMLButtonElement>("#start-button");
const startScreen = document.querySelector<HTMLElement>("#start-screen");
const introScreen = document.querySelector<HTMLElement>("#intro-screen");

if (!canvas || !startButton || !startScreen || !introScreen)
  throw new Error("Game bootstrap elements were not found");

const INTRO_HOLD_MS = 8200;
const INTRO_DISSOLVE_MS = 1900;

let gameModulePromise: Promise<typeof import("./core/Game")> | undefined;
const preloadGame = (): Promise<typeof import("./core/Game")> => {
  gameModulePromise ??= import("./core/Game");
  return gameModulePromise;
};

if (typeof window.requestIdleCallback === "function")
  window.requestIdleCallback(() => void preloadGame(), { timeout: 1800 });
else globalThis.setTimeout(() => void preloadGame(), 500);

const wait = (durationMs: number): Promise<void> =>
  new Promise((resolve) => globalThis.setTimeout(resolve, durationMs));

const playIntro = async (startGame: () => void): Promise<void> => {
  let finished = false;
  const finishIntro = async () => {
    if (finished) return;
    finished = true;
    startGame();
    introScreen.classList.add("dissolving");
    await wait(INTRO_DISSOLVE_MS);
    introScreen.classList.remove("visible", "dissolving");
  };

  startScreen.classList.remove("visible");
  introScreen.classList.add("visible");
  introScreen.addEventListener("click", () => void finishIntro(), {
    once: true,
  });
  await wait(INTRO_HOLD_MS);
  await finishIntro();
};

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  startButton.textContent = "INITIALIZING SECTOR...";
  const { Game } = await preloadGame();
  const game = new Game(canvas);
  await game.initialize();
  await playIntro(() => game.start());
});
