// RNG abstracto. Sin seed = CSPRNG (crypto.getRandomValues).
// Con seed = PRNG determinista (mulberry32) para reproducibilidad / demos.
// NOTA: el determinismo aquí es local al cliente JS — no intenta replicar
// el Mersenne Twister de Python. Un sorteo creado con seed en la PWA es
// reproducible en la misma PWA, no en el backend Python.

export interface Random {
  next(): number; // [0, 1)
  shuffle<T>(arr: T[]): void;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class SeededRandom implements Random {
  private gen: () => number;
  constructor(seed: number) {
    this.gen = mulberry32(seed);
  }
  next(): number {
    return this.gen();
  }
  shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

class SystemRandom implements Random {
  next(): number {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      const j = buf[0] % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}

export function makeRng(seed: number | null): Random {
  return seed === null || seed === undefined ? new SystemRandom() : new SeededRandom(seed);
}
