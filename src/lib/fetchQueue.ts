// 동시 요청 수를 제한하는 신호등 (FRED 폭주 → 502 방지)
// 한 번에 5개만 통과시키고, 나머지는 줄 세웠다가 빈자리가 나면 통과시킴

const MAX_CONCURRENT = 5; // 한 번에 통과시킬 요청 수 (필요하면 숫자만 조절)
let active = 0;
const queue: (() => void)[] = [];

function acquire(): Promise<void> {
  return new Promise((resolve) => {
    if (active < MAX_CONCURRENT) {
      active++;
      resolve();
    } else {
      queue.push(resolve);
    }
  });
}

function release() {
  const next = queue.shift();
  if (next) {
    next(); // 빈자리를 다음 대기자에게 넘김
  } else {
    active--;
  }
}

// fetch 와 사용법이 똑같음. fetch(url) → queuedFetch(url) 로만 바꾸면 됨.
export async function queuedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  await acquire();
  try {
    return await fetch(input, init);
  } finally {
    release();
  }
}