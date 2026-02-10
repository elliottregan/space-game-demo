import { chromium } from "playwright";

const GAME_URL = process.env.GAME_URL || "http://host.docker.internal:5173/";
const TARGET_SOLS = parseInt(process.env.TARGET_SOLS || "30");

async function main() {
  console.log("Launching Chromium...");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  console.log(`Navigating to ${GAME_URL}...`);
  await page.goto(GAME_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: "/output/game-sol0.png", fullPage: true });
  console.log("Screenshot: game-sol0.png (Sol 0)");

  let currentSol = 0;
  let iterations = 0;
  const MAX_ITERATIONS = 200;

  while (currentSol < TARGET_SOLS && iterations < MAX_ITERATIONS) {
    iterations++;

    // Check for event modal and dismiss it by clicking the first choice
    const eventModal = await page.$(".event-modal-overlay");
    if (eventModal) {
      const choiceButton = await page.$(".event-modal button");
      if (choiceButton) {
        const choiceText = await choiceButton.textContent();
        console.log(`  [Sol ${currentSol}] Event! Choosing: "${choiceText?.trim()}"`);
        await choiceButton.click();
        await page.waitForTimeout(300);
      }
      continue;
    }

    // Advance sols
    const remaining = TARGET_SOLS - currentSol;
    const buttonText = remaining >= 10 ? "+10 Sols" : "+1 Sol";
    const button = page.getByRole("button", { name: buttonText, exact: true });

    if ((await button.count()) > 0 && !(await button.isDisabled())) {
      await button.click();
      await page.waitForTimeout(200);
    } else {
      // Button disabled or missing - wait and retry
      await page.waitForTimeout(500);
      continue;
    }

    // Read current sol
    const solEl = page.locator(".sol-display");
    const solText = await solEl.textContent();
    const match = solText?.match(/Sol (\d+)/);
    if (match) {
      const newSol = parseInt(match[1]);
      if (newSol !== currentSol) {
        currentSol = newSol;
        console.log(`Sol ${currentSol}`);
      }
    }
  }

  // Take final screenshot
  await page.screenshot({ path: "/output/game-final.png", fullPage: true });
  console.log(`\nScreenshot: game-final.png (Sol ${currentSol})`);

  // Dump game stats from the UI
  const stats = await page.evaluate(() => {
    const getText = (sel) => document.querySelector(sel)?.textContent?.trim() || "";
    const sol = getText(".sol-display");
    const panels = {};
    document.querySelectorAll("[class*='panel'], [class*='section']").forEach((el) => {
      const heading = el.querySelector("h2, h3, .panel-title");
      if (heading) {
        const key = heading.textContent.trim();
        panels[key] = el.textContent.trim().substring(0, 300);
      }
    });
    return { sol, panels };
  });

  console.log("\n=== Final Game State ===");
  console.log(stats.sol);
  for (const [panel, content] of Object.entries(stats.panels)) {
    console.log(`\n--- ${panel} ---`);
    console.log(content.substring(0, 200));
  }

  await browser.close();
  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
