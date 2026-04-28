import type {
  ChannelSendOptions,
  DirectMessageSendOptions,
} from "../domain/message.js";
import { MessageDispatch } from "./message-dispatch.js";

const dispatch = new MessageDispatch();

/**
 * Sends a channel message through the default desktop session.
 */
export async function sendChannelMessage(options: ChannelSendOptions): Promise<void> {
  await dispatch.sendChannel(options);
}

/**
 * Sends a direct message through the default desktop session.
 */
export async function sendDirectMessage(
  options: DirectMessageSendOptions,
): Promise<void> {
  await dispatch.sendDirectMessage(options);
}
