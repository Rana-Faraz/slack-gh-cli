import { getSlackLandingPage, withSlackBrowserContext } from "./browser-session.js";
import {
  renderMarkdownToSlackHtml,
  resolveMessageInput,
  translateMarkdownToSlack,
} from "./message.js";
import {
  findExistingDirectMessage,
  readSlackWorkspaceSnapshot,
  resolveChannel,
  resolveUser,
} from "./state.js";
import type { ChannelSendOptions, DmSendOptions, SlackUser } from "./types.js";

export async function sendChannelMessage(options: ChannelSendOptions): Promise<void> {
  const snapshot = await readSlackWorkspaceSnapshot();
  const channel = resolveChannel(snapshot, options);
  const rawMessage = await resolveMessageInput(options);
  const preview = translateMarkdownToSlack(rawMessage);
  const richHtml = renderMarkdownToSlackHtml(rawMessage, snapshot.users);

  if (options.dryRun) {
    console.log(`Would send to #${channel.name}`);
    console.log(preview);
    return;
  }

  await withSlackBrowserContext(
    {
      headless: !options.showBrowser,
      useProfileCopy: true,
    },
    async (context) => {
      const page = await getSlackLandingPage(context);
      await page.goto(`https://app.slack.com/client/${snapshot.teamId}/${channel.id}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.waitForTimeout(2_000);
      await sendCurrentComposerMessage(page, richHtml);
    },
  );

  console.log(`Sent to #${channel.name}`);
}

export async function sendDirectMessage(options: DmSendOptions): Promise<void> {
  const snapshot = await readSlackWorkspaceSnapshot();
  const user = resolveUser(snapshot, options);
  const rawMessage = await resolveMessageInput(options);
  const preview = translateMarkdownToSlack(rawMessage);
  const richHtml = renderMarkdownToSlackHtml(rawMessage, snapshot.users);
  const existingDm = findExistingDirectMessage(snapshot, user.id);

  if (options.dryRun) {
    console.log(`Would send to ${user.displayName} (@${user.handle})`);
    console.log(preview);
    return;
  }

  await withSlackBrowserContext(
    {
      headless: !options.showBrowser,
      useProfileCopy: true,
    },
    async (context) => {
      const page = await getSlackLandingPage(context);

      if (existingDm) {
        await page.goto(`https://app.slack.com/client/${snapshot.teamId}/${existingDm.id}`, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        await page.waitForTimeout(2_000);
      } else {
        await openNewDirectMessageComposer(page, user);
      }

      await sendCurrentComposerMessage(page, richHtml);
    },
  );

  console.log(`Sent to ${user.displayName} (@${user.handle})`);
}

async function openNewDirectMessageComposer(
  page: import("playwright-core").Page,
  user: SlackUser,
): Promise<void> {
  await page.locator('[data-qa="composer_button"]').click({ force: true });
  await page.waitForTimeout(1_000);

  const destinationInput = page.locator('[data-qa="composer_page__destination-input"]');
  await destinationInput.click({ force: true });
  await page.keyboard.insertText(user.handle);
  await page.waitForTimeout(1_500);

  const option = page
    .locator('[role="option"]')
    .filter({ hasText: user.handle })
    .first();

  if ((await option.count()) === 0) {
    throw new Error(`Could not find a DM recipient option for @${user.handle}.`);
  }

  await option.click({ force: true });
  await page.waitForTimeout(500);
}

async function sendCurrentComposerMessage(
  page: import("playwright-core").Page,
  richHtml: string,
): Promise<void> {
  const composer = page.locator('[data-qa="texty_input"]');

  await composer.waitFor({ state: "visible", timeout: 30_000 });
  await composer.click({ force: true });
  await page.keyboard.press("Meta+A").catch(() => {});
  await page.keyboard.press("Backspace").catch(() => {});
  await composer.evaluate((element, html) => {
    const editor = element as HTMLElement;
    editor.focus();
    document.execCommand("insertHTML", false, html);
    editor.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: "",
      }),
    );
  }, richHtml);
  await page.waitForTimeout(300);
  await page.locator('[data-qa="texty_send_button"]').click({ force: true });
  await page.waitForTimeout(1_000);
}
