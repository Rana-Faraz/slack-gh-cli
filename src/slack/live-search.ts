import { getSlackLandingPage, withSlackBrowserContext } from "./browser-session.js";
import { readSlackWorkspaceSnapshot } from "./state.js";
import type { ChannelListItem, DirectMessageListItem } from "./types.js";

type LiveDestinationOption = {
  id: string;
  kind: "channel" | "user";
  name: string;
  isPrivate?: boolean;
};

export async function liveSearchChannels(
  query: string,
  limit: number,
): Promise<ChannelListItem[]> {
  const [options, snapshot] = await Promise.all([
    searchLiveDestinations(query),
    readSlackWorkspaceSnapshot(),
  ]);

  return options
    .filter((option) => option.kind === "channel")
    .slice(0, limit)
    .map((option) => {
      const fromSnapshot = snapshot.conversations.find(
        (conversation) => conversation.id === option.id,
      );

      return {
        id: option.id,
        name: option.name,
        visibility:
          option.isPrivate || fromSnapshot?.isPrivate ? "private" : "public",
      };
    });
}

export async function liveSearchUsers(
  query: string,
  limit: number,
): Promise<DirectMessageListItem[]> {
  const [options, snapshot] = await Promise.all([
    searchLiveDestinations(query),
    readSlackWorkspaceSnapshot(),
  ]);

  return options
    .filter((option) => option.kind === "user")
    .slice(0, limit)
    .map((option) => {
      const user = snapshot.users.find((candidate) => candidate.id === option.id);

      return {
        userId: option.id,
        displayName: user?.displayName ?? option.name,
        handle: user?.handle ?? option.name.toLowerCase().replace(/\s+/g, "."),
        conversationId: snapshot.conversations.find(
          (conversation) => conversation.kind === "dm" && conversation.userId === option.id,
        )?.id,
      };
    });
}

async function searchLiveDestinations(query: string): Promise<LiveDestinationOption[]> {
  const quickSwitcherResults = await searchQuickSwitcherDestinations(query);

  if (quickSwitcherResults.length > 0) {
    return quickSwitcherResults;
  }

  return await searchComposerDestinations(query);
}

async function searchQuickSwitcherDestinations(query: string): Promise<LiveDestinationOption[]> {
  const snapshot = await readSlackWorkspaceSnapshot();
  const startingChannel =
    snapshot.conversations.find(
      (conversation) => conversation.kind === "channel" && conversation.name === "general",
    ) ?? snapshot.conversations.find((conversation) => conversation.kind === "channel");

  if (!startingChannel) {
    return [];
  }

  return await withSlackBrowserContext(
    {
      headless: true,
      useProfileCopy: true,
    },
    async (context) => {
      const page = await getSlackLandingPage(context);

      await page.goto(`https://app.slack.com/client/${snapshot.teamId}/${startingChannel.id}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.locator('[data-qa="top_nav_search"]').waitFor({
        state: "visible",
        timeout: 30_000,
      });
      await page.locator('[data-qa="top_nav_search"]').click({ force: true });
      await page.waitForTimeout(800);

      const queryBox = page.locator('[data-qa="texty_input"][aria-label="Query"]').first();
      await queryBox.waitFor({ state: "visible", timeout: 10_000 });
      await queryBox.click({ force: true });
      await page.keyboard.insertText(query);
      await page.waitForTimeout(1_500);

      return await page.evaluate(() => {
        return [...document.querySelectorAll('[role="option"][data-type]')]
          .map((element) => {
            const id = element.getAttribute("data-id");
            const type = element.getAttribute("data-type");
            const label = element.getAttribute("aria-label") ?? "";
            const text = element.textContent?.trim() ?? "";

            if (!id || !type) {
              return null;
            }

            if (type === "member") {
              return {
                id,
                kind: "user" as const,
                name: text.replace(/@.*/, "").trim(),
              };
            }

            if (type === "channel") {
              return {
                id,
                kind: "channel" as const,
                name: text.trim(),
                isPrivate: label.toLowerCase().includes("(private)"),
              };
            }

            return null;
          })
          .filter((item) => item !== null) as LiveDestinationOption[];
      });
    },
  );
}

async function searchComposerDestinations(query: string): Promise<LiveDestinationOption[]> {
  return await withSlackBrowserContext(
    {
      headless: true,
      useProfileCopy: true,
    },
    async (context) => {
      const page = await getSlackLandingPage(context);

      await page.locator('[data-qa="composer_button"]').click({ force: true });
      await page.waitForTimeout(800);

      const destinationInput = page.locator('[data-qa="composer_page__destination-input"]');
      await destinationInput.click({ force: true });
      await page.keyboard.insertText(query);
      await page.waitForTimeout(1_500);

      return await page.evaluate(() => {
        return [...document.querySelectorAll('[role="option"]')]
          .map((element) => {
            const id = element
              .querySelector(".c-select_options_list__option_label")
              ?.getAttribute("data-qa");

            if (!id) {
              return null;
            }

            if (element.querySelector('[data-qa="small_member_entity"]')) {
              const primaryName =
                element.querySelector('[data-qa="member-entity__primary-name"]')
                  ?.textContent ?? element.textContent ?? "";

              return {
                id,
                kind: "user" as const,
                name: primaryName.trim(),
              };
            }

            if (element.querySelector('[data-qa="small_channel_entity"]')) {
              const channelName =
                element.querySelector(".c-channel_entity__name")?.textContent ??
                element.textContent ??
                "";
              const isPrivate = Boolean(
                element.querySelector('[data-channel-type-icon="lock"]'),
              );

              return {
                id,
                kind: "channel" as const,
                name: channelName.trim(),
                isPrivate,
              };
            }

            return null;
          })
          .filter((item) => item !== null) as LiveDestinationOption[];
      });
    },
  );
}
