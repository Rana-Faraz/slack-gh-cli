import type { ChannelSelector, UserSelector } from "./workspace.js";

/**
 * Shared options for commands that accept message text.
 */
export type MessageInputOptions = {
  message?: string;
  stdin?: boolean;
  inputStream?: AsyncIterable<Buffer | string>;
};

/**
 * Options for sending a message to a channel.
 */
export type ChannelSendOptions = ChannelSelector &
  MessageInputOptions & {
    dryRun?: boolean;
    workspace?: string;
  };

/**
 * Options for sending a direct message.
 */
export type DirectMessageSendOptions = UserSelector &
  MessageInputOptions & {
    dryRun?: boolean;
    workspace?: string;
  };

/**
 * Output sink used by application modules that need to report command results.
 */
export type MessageLogger = {
  log(message: string): void;
};
