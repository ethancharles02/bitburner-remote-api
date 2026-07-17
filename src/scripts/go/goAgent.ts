import { GoBoard } from './goBoard.js';
import { Pos } from './pos.js';

export abstract class GoAgent {
    abstract getMove(board: GoBoard): Pos | null;
}
