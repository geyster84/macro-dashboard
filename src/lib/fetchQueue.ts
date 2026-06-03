// 동시 요청 제한 + 자동 재시도 + 중복 요청 합치기 (FRED 502/폭주 방지)

const MAX_CONCURRENT = 5; // 한 번에 통과시킬 요청 수
let active = 0;
const waiters: (() => void)[] = [];

function acquire(): Promise<void> {
  return new Promise((resolve) => {
    if (active < MAX_CONCURRENT) {
      active++;
      resolve();
    } else {
      waiters.push(resolve);
    }
  });
}

function release() {
  const next = waiters.shift();
  if (next) next(); // 빈자리를 다음 대기자에게 넘김
  else active--;
}

// 슬롯 하나 점유하고 fetch 1회 실행
async function fetchOnce(
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

// 같은 URL이 동시에 요청되면 하나로 합치기 위한 보관소
const inflight = new Map<string, Promise<Response>>();

export async function queuedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  retries = 2
): Promise<Response> {
  const key = typeof input === "string" ? input : null;

  // 이미 같은 요청이 진행 중이면 그 결과를 함께 사용 (복제해서 나눠 씀)
  if (key) {
    const existing = inflight.get(key);
    if (existing) return existing.then((res) => res.clone());
  }

  const run = (async () => {
    let lastRes: Response | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetchOnce(input, init);
        lastRes = res;
        // 성공이거나, 재시도해도 소용없는 오류(429 제외 4xx)면 바로 반환
        if (res.ok || (res.status < 500 && res.status !== 429)) {
          return res;
        }
      } catch {
        // 네트워크 오류 → 아래에서 재시도
      }
      // 마지막 시도가 아니면 잠깐 대기 (무작위 지연으로 요청 분산)
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
      }
    }
    if (lastRes) return lastRes;
    throw new Error("요청 실패 (네트워크 오류)");
  })();

  if (key) {
    inflight.set(key, run);
    run.finally(() => inflight.delete(key)).catch(() => {});
    return run.then((res) => res.clone());
  }
  return run;
}