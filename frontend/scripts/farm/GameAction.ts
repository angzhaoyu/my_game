import type { GameCommandType } from '../core/network/Contracts';

export interface GameActionFeedback {
  ok: boolean;
  message: string;
}

export type GameActionHandler = (
  type: GameCommandType,
  payload: Record<string, unknown>,
) => Promise<GameActionFeedback>;
