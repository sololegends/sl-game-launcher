
export const UN_INSTALL_LOCK = "unins_ins";
export const DOWNLOAD = "download";
export const DOWNLOAD_SEQUENCE = "download_seq";
export const ACTION_LOCK = "action_lock";
export const LAUNCH_GAME_LOCK = "launch_game_lock";

export type LockAbortEvents = "abort";

export type LockAbortToken  = {
	aborted: () => boolean
	abort: () => void,
  on: (event: LockAbortEvents, callback: () => void) => void,
  off: (event: LockAbortEvents) => void,
  fire: (event: LockAbortEvents) => void
}
const LOCKS = {} as Record<string, LockAbortToken | undefined>;

async function sleep(milliseconds: number): Promise<void>{
  return new Promise<void>((resolved) => {
    setTimeout(() => {
      resolved();
    }, milliseconds);
  });
}

function initToken(empty = false): LockAbortToken{
  if(empty){
    return {
      aborted: () => {
        return false;
      },
      abort: () => {
        // Nothing here
      },
      on: () => {
        // Nothing
      },
      off: () => {
        // Nothing
      },
      fire: () => {
        // Nothing
      }
    };
  }
  let aborted = false;
  const on_events = {} as Record<string, () => void>;
  const obj = {
    on: (evt: LockAbortEvents, cb: () => void) => {
      on_events[evt] = cb;
    },
    off: (evt: LockAbortEvents) => {
      delete on_events[evt];
    },
    fire: (evt: LockAbortEvents)=> {
      if(on_events[evt]){
        on_events[evt]();
      }
    },
    aborted: () => {
      return aborted;
    }
  } as LockAbortToken;
  obj.abort = function(){
    if(aborted){
      return;
    }
    obj.fire("abort");
    aborted = true;
  };
  return obj;
}

export async function acquireLock(lock: string, cancelable = true, wait_for = true){
  if(!wait_for && LOCKS[lock] !== undefined){
    return undefined;
  }
  while(LOCKS[lock] !== undefined){
    await sleep(1000);
  }
  LOCKS[lock] = initToken(true);
  console.log("Acquired lock: " + lock);
  if(cancelable){
    LOCKS[lock] =  initToken();
  }
  return LOCKS[lock];
}

export function abortLock(lock: string){
  const token = LOCKS[lock];
  if(token !== undefined){
    console.log("Aborting lock: " + lock);
    token.abort();
  }
}

export function abortedLock(lock: string): boolean{
  const locks = LOCKS[lock];
  if(locks){
    return locks.aborted();
  }
  return true;
}

export async function abortAndAcquireLock(lock: string, cancelable?: boolean){
  abortLock(lock);
  return acquireLock(lock, cancelable);
}

export function releaseLock(lock: string){
  console.log("Releasing lock: " + lock);
  if(LOCKS[lock] !== undefined){
    LOCKS[lock]?.abort();
    delete LOCKS[lock];
  }
}

export function clearLocks(){
  for(const lock in LOCKS){
    releaseLock(lock);
  }
}