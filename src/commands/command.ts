import type { SpriteDocument } from "../domain/types";

export interface Command {
  readonly label: string;
  execute(doc: SpriteDocument): void;
  undo(doc: SpriteDocument): void;
}
