import { GoBoard } from './goBoard.js';
import { GoAgent } from './goAgent.js';
import { Pos } from './pos.js';

class MCTSNode {
    board: GoBoard;
    playerNum: number;
    otherPlayerNum: number;
    parent: MCTSNode | null;
    moves: Set<Pos>;
    terminal: boolean;
    children: Map<Pos, MCTSNode | null> = new Map();
    numVisits = 0;
    numWins = 0;
    c: number;

    constructor(board: GoBoard, playerNum: number, parent: MCTSNode | null, c: number = Math.sqrt(2)) {
        this.board = board;
        this.playerNum = playerNum;
        this.otherPlayerNum = playerNum === 2 ? 1 : 2;
        this.parent = parent;
        this.moves = board.getAvailableMoves(playerNum);
        this.terminal = this.moves.size === 0;
        for (const m of this.moves) this.children.set(m, null);
        this.c = c;
    }

    maxChild(): Pos | null {
        let maxNumVisits = 0;
        let maxMove: Pos | null = null;

        for (const m of this.moves) {
            const child = this.children.get(m);
            if (child && child.numVisits > maxNumVisits) {
                maxNumVisits = child.numVisits;
                maxMove = m;
            }
        }
        return maxMove;
    }

    upperBound(N: number): number {
        return this.numWins / this.numVisits + this.c * Math.sqrt(Math.log(N) / this.numVisits);
    }

    select(): MCTSNode {
        let maxUb = -Infinity;
        let maxMove: Pos | null = null;

        if (this.terminal) return this;

        for (const m of this.moves) {
            const existingChild = this.children.get(m);
            if (!existingChild) {
                const newBoard = this.board.copy();
                newBoard.placePiece(this.playerNum, m);

                const child = new MCTSNode(newBoard, this.otherPlayerNum, this, this.c);
                this.children.set(m, child);
                return child;
            }

            const currentUb = existingChild.upperBound(this.numVisits);
            if (currentUb > maxUb) {
                maxUb = currentUb;
                maxMove = m;
            }
        }

        return this.children.get(maxMove!)!.select();
    }

    simulate(maxSimulationDepth: number): void {
        let result: number;
        if (this.board.isWinningState(this.playerNum)) {
            result = -1;
        } else if (
            this.terminal &&
            this.board.capturedPieceCounts[this.otherPlayerNum - 1] > this.board.capturedPieceCounts[this.playerNum - 1]
        ) {
            result = 1;
        } else {
            let validMoves = new Set(this.moves);
            const newBoard = this.board.copy();
            const players = [this.playerNum, this.otherPlayerNum];
            let i = 0;
            while (validMoves.size !== 0 && i < maxSimulationDepth) {
                const curPlayer = players[i % 2];

                const movesArray = Array.from(validMoves);
                const move = movesArray[Math.floor(Math.random() * movesArray.length)];
                validMoves.delete(move);
                if (!newBoard.placePiece(curPlayer, move)) {
                    throw new Error('Failed to place a piece in simulation');
                }

                i += 1;
                validMoves = newBoard.getAvailableMoves(players[i % 2]);
            }

            const playerPieceCount = newBoard.capturedPieceCounts[this.playerNum - 1];
            const otherPlayerPieceCount = newBoard.capturedPieceCounts[this.otherPlayerNum - 1];
            result = otherPlayerPieceCount - playerPieceCount;
        }

        this.numWins += result;
        this.numVisits += 1;

        this.parent!.backProp(-result);
    }

    backProp(score: number): void {
        this.numVisits += 1;
        this.numWins += score;
        if (this.parent !== null) {
            this.parent.backProp(-score);
        }
    }
}

export class MCTSAgent extends GoAgent {
    playerNum: number;
    maxIterations: number;
    maxSimulationDepth: number;
    c: number;

    constructor(playerNum: number, maxIterations: number, maxSimulationDepth: number, c = 1.41) {
        super();
        this.playerNum = playerNum;
        this.maxIterations = maxIterations;
        this.maxSimulationDepth = maxSimulationDepth;
        this.c = c;
    }

    getMove(board: GoBoard): Pos | null {
        const root = new MCTSNode(board, this.playerNum, null, this.c);
        if (root.terminal) return null;

        for (let n = 0; n < this.maxIterations; n++) {
            const curNode = root.select();
            curNode.simulate(this.maxSimulationDepth);
        }

        return root.maxChild();
    }
}
