import { GoGroup } from './goGroup.js';
import { Pos, pos, unpos } from './pos.js';

// A cell is empty (0), occupied by the GoGroup it belongs to, or a dead spot (-1)
// that can never be placed on and doesn't count as a liberty for neighbors.
export type Cell = GoGroup | 0 | -1;
export const DEAD: -1 = -1;

function isGroup(cell: Cell): cell is GoGroup {
    return cell !== 0 && cell !== DEAD;
}

export function createEmptyBoard(height: number, width: number): Cell[][] {
    return Array.from({ length: height }, () => new Array<Cell>(width).fill(0));
}

export class GoBoard {
    board: Cell[][];
    height: number;
    width: number;
    capturedPieceCounts: [number, number] = [0, 0];
    lastPiecePlacements: [Pos | null, Pos | null] = [null, null];
    groups: Set<GoGroup> = new Set();

    constructor(initialBoard: Cell[][]) {
        this.board = initialBoard;
        this.height = initialBoard.length;
        this.width = initialBoard[0].length;
    }

    copy(): GoBoard {
        const newBoard = new GoBoard(this.board.map((row) => row.slice()));
        newBoard.capturedPieceCounts = [...this.capturedPieceCounts];
        newBoard.lastPiecePlacements = [...this.lastPiecePlacements];

        for (const group of this.groups) {
            const newGroup = group.copy(newBoard);
            newBoard.groups.add(newGroup);
            for (const p of newGroup.piecePositions) {
                const [y, x] = unpos(p);
                newBoard.board[y][x] = newGroup;
            }
        }

        return newBoard;
    }

    getAvailableMoves(playerNum: number): Set<Pos> {
        const availableMoves = new Set<Pos>();
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.board[y][x] === 0) {
                    const p = pos(y, x);
                    if (this.canPlacePiece(playerNum, p)) {
                        availableMoves.add(p);
                    }
                }
            }
        }
        return availableMoves;
    }

    isWinningState(playerNum: number): boolean {
        const other = this.otherPlayer(playerNum);
        return (
            this.getAvailableMoves(other).size === 0 &&
            this.capturedPieceCounts[playerNum - 1] > this.capturedPieceCounts[other - 1]
        );
    }

    isTie(): boolean {
        return (
            this.getAvailableMoves(1).size === 0 &&
            this.getAvailableMoves(2).size === 0 &&
            this.capturedPieceCounts[0] === this.capturedPieceCounts[1]
        );
    }

    isOnBoard(p: Pos): boolean {
        const [y, x] = unpos(p);
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    canPlacePiece(playerNum: number, p: Pos, verbose = false): boolean {
        if (!this.isOnBoard(p)) {
            return false;
        }

        const [y, x] = unpos(p);
        if (this.board[y][x] !== 0) {
            return false;
        }

        // Can't place in the same spot twice in a row
        if (this.lastPiecePlacements[playerNum - 1] !== null && p === this.lastPiecePlacements[playerNum - 1]) {
            if (verbose) console.log("Can't place piece in same spot twice");
            return false;
        }

        // If there is at least one open spot, we know a piece can be placed for sure
        if (this.getSurroundingPositions(p, 0).length > 0) {
            return true;
        }

        for (const position of this.getSurroundingPositions(p)) {
            const [py, px] = unpos(position);
            const posGroup = this.board[py][px];
            if (!isGroup(posGroup)) continue;
            // Can't place if it is the last open spot
            if (posGroup.playerNum === playerNum) {
                if (posGroup.openPositions.size > 1) return true;
            } else if (posGroup.playerNum === this.otherPlayer(playerNum)) {
                // Can place if it would kill an enemy group
                if (posGroup.openPositions.size === 1) return true;
            }
        }

        return false;
    }

    placePiece(playerNum: number, p: Pos): boolean {
        if (!this.canPlacePiece(playerNum, p, true)) {
            return false;
        }

        this.lastPiecePlacements[playerNum - 1] = p;

        const surroundingGroups = new Set<GoGroup>();
        for (const position of this.getSurroundingPositions(p, playerNum)) {
            const [y, x] = unpos(position);
            surroundingGroups.add(this.board[y][x] as GoGroup);
        }

        let mergeGroup: GoGroup;
        if (surroundingGroups.size > 0) {
            mergeGroup = surroundingGroups.values().next().value!;
            surroundingGroups.delete(mergeGroup);
            mergeGroup.mergeGroups(surroundingGroups, p);
            for (const position of mergeGroup.piecePositions) {
                const [y, x] = unpos(position);
                this.board[y][x] = mergeGroup;
            }
            for (const g of surroundingGroups) this.groups.delete(g);
        } else {
            mergeGroup = new GoGroup(this, playerNum, p);
            const [y, x] = unpos(p);
            this.board[y][x] = mergeGroup;
            this.groups.add(mergeGroup);
        }

        const otherPlayerNum = this.otherPlayer(playerNum);
        const surroundingEnemyGroups = new Set<GoGroup>();
        for (const position of this.getSurroundingPositions(p, otherPlayerNum)) {
            const [y, x] = unpos(position);
            surroundingEnemyGroups.add(this.board[y][x] as GoGroup);
        }

        const groupsToDelete = new Set<GoGroup>();
        for (const group of surroundingEnemyGroups) {
            group.updateOpenPositions(p, false);
            if (group.openPositions.size === 0) groupsToDelete.add(group);
        }

        for (const g of groupsToDelete) this.groups.delete(g);
        for (const group of groupsToDelete) {
            for (const position of group.piecePositions) {
                this.capturedPieceCounts[playerNum - 1] += 1;
                // Update open positions for the removed piece
                for (const surroundingPosition of this.getSurroundingPositions(position, playerNum)) {
                    const [sy, sx] = unpos(surroundingPosition);
                    (this.board[sy][sx] as GoGroup).openPositions.add(position);
                }
                const [py, px] = unpos(position);
                this.board[py][px] = 0;
            }
        }

        return true;
    }

    otherPlayer(playerNum: number): number {
        return playerNum === 1 ? 2 : 1;
    }

    getSurroundingPositions(p: Pos, numFilter?: number): Pos[] {
        const [y, x] = unpos(p);
        const candidates: Pos[] = [pos(y + 1, x), pos(y - 1, x), pos(y, x + 1), pos(y, x - 1)];
        if (numFilter === undefined) {
            return candidates.filter((c) => this.isOnBoard(c));
        }
        return candidates.filter((c) => {
            if (!this.isOnBoard(c)) return false;
            const [cy, cx] = unpos(c);
            const cell = this.board[cy][cx];
            return numFilter === 0 ? cell === 0 : isGroup(cell) && cell.playerNum === numFilter;
        });
    }

    toString(): string {
        return this.board.map((row) => row.map((c) => (isGroup(c) ? c.playerNum : c)).join(' ')).join('\n');
    }
}
