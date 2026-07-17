import type { GoBoard } from './goBoard.js';
import { Pos } from './pos.js';

export class GoGroup {
    playerNum: number;
    piecePositions: Set<Pos> = new Set();
    openPositions: Set<Pos> = new Set();
    board: GoBoard;

    constructor(board: GoBoard, playerNum: number, initialPosition: Pos | null = null) {
        this.board = board;
        this.playerNum = playerNum;
        if (initialPosition !== null) {
            this.addPieceUnchecked(initialPosition);
        }
    }

    copy(board: GoBoard): GoGroup {
        const newGroup = new GoGroup(board, this.playerNum, null);
        newGroup.piecePositions = new Set(this.piecePositions);
        newGroup.openPositions = new Set(this.openPositions);
        return newGroup;
    }

    mergeGroups(groups: Set<GoGroup>, intersectionPosition: Pos): void {
        for (const group of groups) {
            for (const p of group.piecePositions) this.piecePositions.add(p);
            for (const p of group.openPositions) this.openPositions.add(p);
        }
        this.addPiece(intersectionPosition);
    }

    addPiece(pos: Pos): void {
        if (!this.openPositions.has(pos)) {
            throw new Error("Can't place piece in group that isn't open");
        }
        this.addPieceUnchecked(pos);
    }

    private addPieceUnchecked(pos: Pos): void {
        this.piecePositions.add(pos);
        this.updateOpenPositions(pos, true);
    }

    updateOpenPositions(pos: Pos, isFriendly: boolean): void {
        this.openPositions.delete(pos);
        if (isFriendly) {
            for (const p of this.board.getSurroundingPositions(pos, 0)) {
                this.openPositions.add(p);
            }
        }
    }
}
