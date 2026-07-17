// A board position, encoded as "y,x" so it can be used directly as a Set/Map key
// (mirrors Python tuples, which hash by value).
export type Pos = string;

export function pos(y: number, x: number): Pos {
    return `${y},${x}`;
}

export function unpos(p: Pos): [number, number] {
    const [y, x] = p.split(',');
    return [Number(y), Number(x)];
}
