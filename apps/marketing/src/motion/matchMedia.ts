type Conditions = Record<string, boolean>;

interface MatchMediaContext {
  conditions: Conditions;
}

type MatchMediaCallback = (context: MatchMediaContext) => (() => void) | void;

interface MatchMediaControls {
  add: (queries: Record<string, string>, callback: MatchMediaCallback) => MatchMediaControls;
  revert: () => void;
}

const matchMedia = (): MatchMediaControls => {
  const entries: {
    mqls: MediaQueryList[];
    listeners: (() => void)[];
    cleanup: (() => void) | undefined;
  }[] = [];

  const mm: MatchMediaControls = {
    add: (queries, callback) => {
      const mqls = Object.entries(queries).map(([key, query]) => ({
        key,
        mql: window.matchMedia(query),
      }));

      let cleanup: (() => void) | undefined = undefined;

      const getConditions = (): Conditions =>
        Object.fromEntries(mqls.map(({ key, mql }) => [key, mql.matches]));

      const run = () => {
        cleanup?.();
        cleanup = callback({ conditions: getConditions() }) ?? undefined;
      };

      const listeners = mqls.map(({ mql }) => {
        const listener = () => run();
        mql.addEventListener("change", listener);
        return () => mql.removeEventListener("change", listener);
      });

      run();

      entries.push({
        mqls: mqls.map(({ mql }) => mql),
        listeners,
        cleanup,
      });

      return mm;
    },

    revert: () => {
      entries.forEach(({ listeners, cleanup }) => {
        cleanup?.();
        listeners.forEach((remove) => remove());
      });
      entries.length = 0;
    },
  };

  return mm;
};

export default matchMedia;
