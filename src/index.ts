import React, { EffectCallback, DependencyList } from 'react';

function useMountEffect(effect: EffectCallback) {
  React.useEffect(effect, []);
}

function useIsJustMountedState(): boolean {
  const isJustMounted = React.useRef(true);

  if (isJustMounted.current) {
    isJustMounted.current = false;

    return true;
  }

  return isJustMounted.current;
}

function useUpdateOnlyEffect(
  effect: EffectCallback,
  dependencies?: DependencyList
) {
  const isJustMounted = useIsJustMountedState();

  React.useEffect(() => {
    if (!isJustMounted) {
      return effect();
    }
  }, dependencies);
}

function useForceUpdate() {
  const triggerUpdate = React.useState({})[1];

  return React.useCallback(() => {
    triggerUpdate({});
  }, []);
}

// typescript has issues with unique symbol type for Set and Record
// this is a work around
const uniqueSymbol: unique symbol = Symbol('_');
type UniqueSymbol = typeof uniqueSymbol;

export type Selector<State, StateSlice> = (state: State) => StateSlice;
export type EqualityCheck<StateSlice> = (
  prevSlice: StateSlice,
  nextSlice: StateSlice
) => boolean;
interface Listener<State, StateSlice> {
  triggerUpdate: ReturnType<typeof useForceUpdate>;
  prevSlice: StateSlice;
  selector: Selector<State, StateSlice>;
  equalityCheck: EqualityCheck<StateSlice>;
}
type Listeners<State, StateSlice> = Record<
  UniqueSymbol,
  Listener<State, StateSlice>
>;
export type StateUpdaterCallback<State> = (prevState: State) => State;
export type SetState<State> = (
  arg: StateUpdaterCallback<State> | State
) => void;
export type GetState<State> = () => State;

type StateTypes =
  | Record<string | number | symbol, unknown>
  | string
  | number
  | boolean
  | undefined
  | null;

interface UseStore<State extends StateTypes | Array<StateTypes>> {
  (
    selector?: Selector<State, State>,
    equalityCheck?: EqualityCheck<State>
  ): State;
  <StateSlice>(
    selector?: Selector<State, StateSlice>,
    equalityCheck?: EqualityCheck<StateSlice>
  ): StateSlice;
  set: SetState<State>;
  get: GetState<State>;
}

export function createStore<State extends StateTypes | Array<StateTypes>>(
  initialState: State | (() => State)
): UseStore<State> {
  const listenerKeys = new Set<UniqueSymbol>();
  let listeners: Listeners<State, unknown> = {} as Listeners<State, unknown>;

  const store = {
    state: typeof initialState === 'function' ? initialState() : initialState,
    getState(): State {
      return this.state;
    },
  };

  function updater(arg: StateUpdaterCallback<State> | State): void {
    let newState: State;
    if (typeof arg === 'function') {
      newState = arg(store.state);
    } else {
      newState = arg;
    }

    store.state = newState;

    listenerKeys.forEach((key: UniqueSymbol) => {
      const listener = listeners[key];

      const nextSlice = listener.selector(store.state);

      if (!listener.equalityCheck(listener.prevSlice, nextSlice)) {
        listener.triggerUpdate();
      }
    });
  }

  const defaultSelector: Selector<State, State> = (state) => state;
  const defaultEqualityCheck: EqualityCheck<State> = (prevSlice, nextSlice) =>
    prevSlice === nextSlice;

  const useStore = (
    selector = defaultSelector,
    equalityCheck = defaultEqualityCheck
  ) => {
    const state = store.getState();
    const currentSlice = selector(state);

    const listenerKeyRef = React.useRef(Symbol('listener'));

    const triggerUpdate = useForceUpdate();

    useMountEffect(() => {
      const listenerKey = listenerKeyRef.current;
      listenerKeys.add(listenerKey as UniqueSymbol);
      listeners[listenerKey] = {
        triggerUpdate,
        prevSlice: currentSlice,
        selector,
        equalityCheck,
      };

      if (!equalityCheck(currentSlice, selector(store.getState()))) {
        triggerUpdate();
      }

      return () => {
        listenerKeys.delete(listenerKey as UniqueSymbol);
        delete listeners[listenerKey];
      };
    });

    useUpdateOnlyEffect(() => {
      const listenerKey = listenerKeyRef.current;
      listeners[listenerKey].selector = selector;
    }, [selector]);

    useUpdateOnlyEffect(() => {
      const listenerKey = listenerKeyRef.current;
      listeners[listenerKey].equalityCheck = equalityCheck;

      if (!equalityCheck(currentSlice, selector(store.getState()))) {
        triggerUpdate();
      }
    }, [equalityCheck]);

    useUpdateOnlyEffect(() => {
      const listenerKey = listenerKeyRef.current;
      listeners[listenerKey].prevSlice = currentSlice;
    });

    return currentSlice;
  };

  useStore.set = updater;
  useStore.get = store.getState.bind(store) as GetState<State>;

  return useStore;
}
