import { NS } from "@ns";

import { GoBoard, createEmptyBoard } from './goBoard';
import { MCTSAgent } from './mctsAgent.js';
import { Pos, pos, unpos } from './pos.js';

export enum GoOpponent {
    netBurners = "Netburners",
    slumSnakes = "Slum Snakes",
    blackHand = "The Black Hand",
    tetrads = "Tetrads",
    daedalus = "Daedalus",
    illuminati = "Illuminati",
    question = "????????????",
    noAi = "No AI"
}

export enum GameResult {
    move = "move",
    pass = "pass",
    gameOver = "gameOver"
}

export async function main(ns: NS) {
    while (true) {
        ns.go.resetBoardState(GoOpponent.netBurners, 7);
        const boardState = ns.go.getBoardState()
        const goBoard = new GoBoard(createEmptyBoard(7, 7));
        const maxIterations = 2000;
        const maxSimulationDepth = 20;
        const mctsAgent = new MCTSAgent(1, maxIterations, maxSimulationDepth);

        for (let x = 0; x < 7; x++) {
            for (let y = 0; y < 7; y++) {
                if (boardState[x][y] == "#") {
                    goBoard.board[y][x] = -1;
                }
            }
        }

        let lastEnemyMove: string | null = null;
        while (true) {
            try {

                let result;
                if (lastEnemyMove == GameResult.pass) {
                    result = await ns.go.passTurn(false);
                } else {
                    const move: Pos | null = mctsAgent.getMove(goBoard);
                    if (move) {
                        if (!goBoard.placePiece(1, move)) {
                            throw Error("Can't place player piece on that spot");
                        }
                        const [y, x] = unpos(move);
                        result = await ns.go.makeMove(x, y, false);
                    } else {
                        result = await ns.go.passTurn(false);
                    }
                }

                lastEnemyMove = result.type;

                if (result.type == GameResult.gameOver) {
                    break;
                }

                if (result.type == GameResult.move && result.x !== null && result.y !== null) {
                    if (!goBoard.placePiece(2, pos(result.y, result.x))) {
                        throw Error("Can't place enemy piece on that spot");
                    }
                }
            } catch (error) {
                ns.tprintf("Caught error, resetting board: %s", error);
                break;
            }
        }
    }
}