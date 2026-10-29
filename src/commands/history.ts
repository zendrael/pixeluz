import { HISTORY_LIMIT } from "../domain/limits";
import type { SpriteDocument } from "../domain/types";
import type { Command } from "./command";

export class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  constructor(private readonly limit = HISTORY_LIMIT) {}

  pushApplied(command: Command): void {
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(doc: SpriteDocument): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;
    command.undo(doc);
    this.redoStack.push(command);
    return true;
  }

  redo(doc: SpriteDocument): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;
    command.execute(doc);
    this.undoStack.push(command);
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
