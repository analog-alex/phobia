import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const startButton = document.querySelector<HTMLButtonElement>("#start-button");

if (!canvas || !startButton) throw new Error("Game bootstrap elements were not found");

let gameModulePromise: Promise<typeof import("./core/Game")> | undefined;
const preloadGame = (): Promise<typeof import("./core/Game")> => {
  gameModulePromise ??= import("./core/Game");
  return gameModulePromise;
};

if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => void preloadGame(), { timeout: 1800 });
else globalThis.setTimeout(() => void preloadGame(), 500);

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  startButton.textContent = "INITIALIZING SECTOR...";
  const { Game } = await preloadGame();
  const game = new Game(canvas);
  await game.initialize();
  game.start();
});
